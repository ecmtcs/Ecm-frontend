"""
AWS Lambda (Function URL): delete document from S3 Archival/ and DynamoDB by UUID.

Request (POST JSON):
  { "documentId": "<uuid>" }

Deletes:
  - S3 object at FilePath (Archival/ only)
  - Main DocumentMetadata item (DocumentId = uuid)
  - GSI shadow items (SEARCH#<uuid>#<PREFIX>)

IAM:
  - dynamodb:GetItem, dynamodb:DeleteItem on DocumentMetadata
  - s3:DeleteObject on aaas-content-vault-2026/Archival/*
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
ARCHIVAL_PREFIX = os.environ.get("ARCHIVAL_PREFIX", "Archival/")

SEARCH_SHADOW_PREFIXES = ("ACCOUNTNUMBER", "ACCOUNTHOLDERNAME", "BRANCH")

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


def _delete_search_shadow_items(document_id: str) -> int:
    deleted = 0
    for prefix in SEARCH_SHADOW_PREFIXES:
        search_id = f"SEARCH#{document_id}#{prefix}"
        try:
            metadata_table.delete_item(
                Key={"DocumentId": search_id},
                ConditionExpression="attribute_exists(DocumentId)",
            )
            deleted += 1
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
    return deleted


def delete_document(document_id: str) -> dict:
    document_id = (document_id or "").strip()
    if not document_id:
        raise ValueError("documentId is required")

    response = metadata_table.get_item(Key={"DocumentId": document_id})
    item = response.get("Item")

    if not item:
        raise ValueError(f"Document not found: {document_id}")

    if item.get("ReferenceDocumentId"):
        raise ValueError("documentId must be the main document UUID, not a search index item")

    file_path = item.get("FilePath") or item.get("filePath") or ""
    s3_deleted = False
    archival_prefix = ARCHIVAL_PREFIX.rstrip("/") + "/"

    if file_path:
        bucket, key = _parse_s3_location(file_path)
        if not key.startswith(archival_prefix):
            raise ValueError(f"Refusing to delete object outside {archival_prefix}")

        s3.delete_object(Bucket=bucket, Key=key)
        s3_deleted = True

    shadow_deleted = _delete_search_shadow_items(document_id)

    metadata_table.delete_item(
        Key={"DocumentId": document_id},
        ConditionExpression="attribute_exists(DocumentId)",
    )

    return {
        "documentId": document_id,
        "deleted": True,
        "s3Deleted": s3_deleted,
        "shadowItemsDeleted": shadow_deleted,
    }


def lambda_handler(event, context):
    request_context = event.get("requestContext") or {}
    http_method = request_context.get("http", {}).get("method") or event.get("httpMethod")

    if http_method == "OPTIONS":
        return _response(200, {"message": "OK"})

    try:
        payload = _parse_event_body(event)
        document_id = payload.get("documentId") or payload.get("DocumentId") or ""

        result = delete_document(document_id)
        return _response(200, result)

    except ValueError as exc:
        return _response(404, {"error": str(exc)})

    except Exception as exc:
        return _response(500, {"error": str(exc)})
