"""
AWS Lambda (Function URL): manage S3 object versions for a document.

Requires S3 bucket versioning to be enabled.

Request (POST JSON):
  { "documentId": "<uuid>", "action": "list" }
  { "documentId": "<uuid>", "action": "promote", "versionId": "<s3-version-id>" }
  { "documentId": "<uuid>", "action": "demote" }
  { "documentId": "<uuid>", "action": "upgrade", "fileBase64": "<base64>" }
  POST raw file body with headers: X-Action: upgrade, X-Document-Id: <uuid>, Content-Type: <mime>

Actions:
  - list           : return every stored version of the document object (newest first).
  - promote        : make the given versionId the current/active version by copying it
                     to the top of the version stack (non-destructive).
  - demote         : roll the current version back to the immediately previous version
                     (same non-destructive copy-to-top mechanism).
  - upgrade        : upload file bytes to the document's existing S3 key via Lambda (no browser
                     CORS to S3). Accepts raw POST body or JSON with fileBase64.
  - prepareUpgrade : (optional) presigned PUT URL if you prefer direct browser → S3 upload.
  - finalizeUpgrade: sync metadata after a direct presigned upload.

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
  - dynamodb:GetItem, dynamodb:PutItem on DocumentMetadata
  - s3:ListBucketVersions on bucket
  - s3:GetObject, s3:GetObjectVersion, s3:PutObject, s3:HeadObject on bucket (presign + copy + upgrade)
"""

import base64
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
UPLOAD_PRESIGNED_EXPIRY = int(os.environ.get("UPLOAD_PRESIGNED_EXPIRY_SECONDS", "900"))

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
metadata_table = dynamodb.Table(DYNAMODB_TABLE)
s3 = boto3.client("s3", region_name=AWS_REGION)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Document-Id, X-Action",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}

MAX_UPGRADE_BYTES = int(os.environ.get("MAX_UPGRADE_BYTES", str(5 * 1024 * 1024)))


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


def _normalize_headers(headers: dict) -> dict:
    normalized: dict[str, str] = {}
    for key, value in (headers or {}).items():
        if isinstance(value, list):
            value = value[0] if value else ""
        normalized[key.lower()] = str(value)
    return normalized


def _read_binary_body(event: dict) -> bytes:
    body = event.get("body")
    if body is None or body == "":
        return b""
    if event.get("isBase64Encoded"):
        return base64.b64decode(body)
    if isinstance(body, bytes):
        return body
    if isinstance(body, str):
        return body.encode("latin-1")
    return b""


def _parse_event_body(event: dict) -> dict:
    body = event.get("body")
    if not body:
        return {}
    if isinstance(body, str):
        stripped = body.strip()
        if not stripped or stripped[0] not in "{[":
            return {}
        return json.loads(stripped)
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


def _put_upgrade(bucket: str, key: str, data: bytes, content_type: str) -> None:
    """Write bytes to the canonical key (new S3 version when versioning is enabled)."""
    if not data:
        raise ValueError("File content is empty")
    if len(data) > MAX_UPGRADE_BYTES:
        raise ValueError(
            f"File exceeds maximum upload size ({MAX_UPGRADE_BYTES // (1024 * 1024)} MB)"
        )

    content_type = (content_type or "application/octet-stream").strip()
    try:
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    except ClientError as exc:
        raise ValueError(f"Could not upload new version: {exc}") from exc


def _prepare_upgrade(bucket: str, key: str, content_type: str) -> dict:
    """Presigned PUT to the canonical object key (new S3 version when versioning is on)."""
    content_type = (content_type or "application/octet-stream").strip()
    try:
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=UPLOAD_PRESIGNED_EXPIRY,
        )
    except ClientError as exc:
        raise ValueError(f"Could not prepare upgrade upload: {exc}") from exc

    return {
        "uploadUrl": upload_url,
        "key": key,
        "contentType": content_type,
        "expiresIn": UPLOAD_PRESIGNED_EXPIRY,
    }


def _sync_metadata_from_s3(document_id: str, bucket: str, key: str) -> None:
    """Update DynamoDB Size/MimeType from the current S3 object after an upgrade."""
    try:
        head = s3.head_object(Bucket=bucket, Key=key)
    except ClientError as exc:
        raise ValueError(f"Could not read uploaded object: {exc}") from exc

    response = metadata_table.get_item(Key={"DocumentId": document_id})
    item = response.get("Item")
    if not item:
        return

    content_length = head.get("ContentLength")
    if content_length is not None:
        item["Size"] = content_length
    content_type = head.get("ContentType")
    if content_type:
        item["MimeType"] = content_type

    metadata_table.put_item(
        Item=item,
        ConditionExpression="attribute_exists(DocumentId)",
    )


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


def handle_request(
    document_id: str,
    action: str,
    version_id: str,
    content_type: str = "",
    file_data: bytes | None = None,
) -> dict:
    canonical_id, bucket, key = _resolve_object(document_id)
    action = (action or "list").strip().lower()

    if action == "upgrade":
        if file_data is None:
            raise ValueError("file content is required for upgrade")
        _put_upgrade(bucket, key, file_data, content_type)
        _sync_metadata_from_s3(canonical_id, bucket, key)

    elif action == "promote":
        if not version_id:
            raise ValueError("versionId is required to promote a version")
        _activate_version(bucket, key, version_id)

    elif action == "demote":
        current = _list_versions(bucket, key, include_urls=False)
        if len(current) < 2:
            raise ValueError("No earlier version available to demote to")
        # current[0] is the active version; current[1] is its predecessor.
        _activate_version(bucket, key, current[1]["versionId"])

    elif action == "prepareupgrade":
        return {
            "documentId": canonical_id,
            "key": key,
            **_prepare_upgrade(bucket, key, content_type),
        }

    elif action == "finalizeupgrade":
        _sync_metadata_from_s3(canonical_id, bucket, key)

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
    headers = _normalize_headers(event.get("headers") or {})

    if http_method == "OPTIONS":
        return _response(200, {"message": "OK"})

    try:
        header_action = (headers.get("x-action") or "").strip().lower()
        if header_action == "upgrade":
            document_id = (headers.get("x-document-id") or "").strip()
            content_type = headers.get("content-type") or "application/octet-stream"
            file_data = _read_binary_body(event)
            result = handle_request(
                document_id,
                "upgrade",
                "",
                content_type,
                file_data=file_data,
            )
            return _response(200, result)

        payload = _parse_event_body(event)
        document_id = payload.get("documentId") or payload.get("DocumentId") or ""
        action = payload.get("action") or "list"
        version_id = payload.get("versionId") or payload.get("VersionId") or ""
        content_type = payload.get("contentType") or payload.get("ContentType") or ""

        file_data = None
        if (action or "").strip().lower() == "upgrade":
            encoded = payload.get("fileBase64") or payload.get("fileData") or ""
            if not encoded:
                raise ValueError("fileBase64 is required for JSON upgrade uploads")
            file_data = base64.b64decode(encoded)

        result = handle_request(
            document_id,
            action,
            version_id,
            content_type,
            file_data=file_data,
        )
        return _response(200, result)

    except ValueError as exc:
        return _response(404, {"error": str(exc)})

    except Exception as exc:
        return _response(500, {"error": str(exc)})
