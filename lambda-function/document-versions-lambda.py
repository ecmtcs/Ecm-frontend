"""
AWS Lambda (Function URL): manage S3 object versions for a document.

Requires S3 bucket versioning to be enabled.

Request (POST JSON):
  { "documentId": "<uuid>", "action": "list" }
  { "documentId": "<uuid>", "action": "promote", "versionId": "<s3-version-id>" }
  { "documentId": "<uuid>", "action": "demote" }

Actions:
  - list    : return every stored version of the document object (newest first).
  - promote : make the given versionId the current/active version by copying it
              to the top of the version stack (non-destructive).
  - demote  : roll the current version back to the immediately previous version
              (same non-destructive copy-to-top mechanism).

Response (200):
  {
    "documentId": "...",
    "key": "Archival/...",
    "versions": [
      { "versionId": "...", "isLatest": true, "lastModified": "...", "size": 123, "viewUrl": "https://..." },
      ...
    ]
  }

IAM:
  - dynamodb:GetItem on DocumentMetadata
  - s3:ListBucketVersions on bucket
  - s3:GetObject, s3:GetObjectVersion, s3:PutObject on bucket (for presign + copy)
"""

import json
import os
import re
from decimal import Decimal
from typing import Any
from urllib.parse import unquote, urlparse

import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "DocumentMetadata")
DEFAULT_BUCKET = os.environ.get("S3_BUCKET", "aaas-content-vault-2026")
PRESIGNED_EXPIRY = int(os.environ.get("PRESIGNED_EXPIRY_SECONDS", "3600"))

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
metadata_table = dynamodb.Table(DYNAMODB_TABLE)
s3 = boto3.client("s3", region_name=AWS_REGION)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}


def _response(status_code: int, body: Any) -> dict:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=_json_default),
    }


def _json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError()


def _parse_event_body(event: dict) -> dict:
    body = event.get("body")
    if not body:
        return {}
    if isinstance(body, str):
        return json.loads(body) if body.strip() else {}
    return body


def _parse_s3_location(file_path: str) -> tuple[str, str]:
    file_path = (file_path or "").strip()
    if not file_path:
        raise ValueError("FilePath is empty")

    if file_path.startswith("s3://"):
        parsed = urlparse(file_path)
        return parsed.netloc, unquote(parsed.path.lstrip("/"))

    if file_path.startswith(("http://", "https://")):
        parsed = urlparse(file_path)
        host = parsed.netloc

        virtual_host = re.match(
            r"^(.+?)\.s3[.-][a-z0-9-]+\.amazonaws\.com$",
            host,
            re.IGNORECASE,
        )
        if virtual_host:
            return virtual_host.group(1), unquote(parsed.path.lstrip("/"))

        path_match = re.match(r"^/([^/]+)/(.+)$", parsed.path)
        if path_match and "amazonaws.com" in host:
            return path_match.group(1), unquote(path_match.group(2))

        raise ValueError(f"Unsupported S3 URL format: {file_path}")

    return DEFAULT_BUCKET, file_path.lstrip("/")


def _resolve_object(document_id: str) -> tuple[str, str, str]:
    """Resolve the canonical document and its S3 (bucket, key)."""
    document_id = (document_id or "").strip()
    if not document_id:
        raise ValueError("documentId is required")

    response = metadata_table.get_item(Key={"DocumentId": document_id})
    item = response.get("Item")
    if not item:
        raise ValueError(f"Document not found: {document_id}")

    if item.get("ReferenceDocumentId"):
        ref_id = item["ReferenceDocumentId"]
        ref_response = metadata_table.get_item(Key={"DocumentId": ref_id})
        item = ref_response.get("Item")
        if not item:
            raise ValueError(f"Document not found: {document_id}")
        document_id = ref_id

    file_path = item.get("FilePath") or item.get("filePath") or ""
    if not file_path:
        raise ValueError("Document has no FilePath")

    bucket, key = _parse_s3_location(file_path)
    return document_id, bucket, key


def _list_versions(bucket: str, key: str, include_urls: bool = True) -> list[dict]:
    """Return all object versions for the exact key, newest first.

    Set ``include_urls=False`` to skip presigned-URL signing when callers only
    need version IDs (e.g. resolving the predecessor for a demote).
    """
    versions: list[dict] = []
    paginator = s3.get_paginator("list_object_versions")

    for page in paginator.paginate(Bucket=bucket, Prefix=key):
        for entry in page.get("Versions", []):
            if entry.get("Key") != key:
                continue

            version_id = entry.get("VersionId")
            last_modified = entry.get("LastModified")
            version = {
                "versionId": version_id,
                "isLatest": bool(entry.get("IsLatest")),
                "lastModified": last_modified.isoformat() if last_modified else None,
                "size": entry.get("Size"),
            }

            if include_urls:
                version["viewUrl"] = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket, "Key": key, "VersionId": version_id},
                    ExpiresIn=PRESIGNED_EXPIRY,
                )

            versions.append(version)

    versions.sort(key=lambda v: v["lastModified"] or "", reverse=True)
    return versions


def _activate_version(bucket: str, key: str, version_id: str) -> None:
    """Copy a specific version onto the key, making it the current version."""
    try:
        s3.copy_object(
            Bucket=bucket,
            Key=key,
            CopySource={"Bucket": bucket, "Key": key, "VersionId": version_id},
            MetadataDirective="COPY",
        )
    except ClientError as exc:
        raise ValueError(f"Could not activate version: {exc}") from exc


def handle_request(document_id: str, action: str, version_id: str) -> dict:
    canonical_id, bucket, key = _resolve_object(document_id)
    action = (action or "list").strip().lower()

    if action == "promote":
        if not version_id:
            raise ValueError("versionId is required to promote a version")
        _activate_version(bucket, key, version_id)

    elif action == "demote":
        current = _list_versions(bucket, key, include_urls=False)
        if len(current) < 2:
            raise ValueError("No earlier version available to demote to")
        # current[0] is the active version; current[1] is its predecessor.
        _activate_version(bucket, key, current[1]["versionId"])

    elif action != "list":
        raise ValueError(f"Unsupported action: {action}")

    return {
        "documentId": canonical_id,
        "key": key,
        "versions": _list_versions(bucket, key),
    }


def lambda_handler(event, context):
    request_context = event.get("requestContext") or {}
    http_method = request_context.get("http", {}).get("method") or event.get("httpMethod")

    if http_method == "OPTIONS":
        return _response(200, {"message": "OK"})

    try:
        payload = _parse_event_body(event)
        document_id = payload.get("documentId") or payload.get("DocumentId") or ""
        action = payload.get("action") or "list"
        version_id = payload.get("versionId") or payload.get("VersionId") or ""

        result = handle_request(document_id, action, version_id)
        return _response(200, result)

    except ValueError as exc:
        return _response(404, {"error": str(exc)})

    except Exception as exc:
        return _response(500, {"error": str(exc)})
