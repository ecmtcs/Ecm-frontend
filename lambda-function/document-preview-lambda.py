"""
AWS Lambda (Function URL): fetch document metadata from DynamoDB and return a presigned S3 URL for in-browser PDF preview.

Request (POST JSON):
  { "documentId": "<uuid>" }

Response (200):
  {
    "documentId": "...",
    "previewUrl": "https://...",
    "metadata": { ... all DynamoDB attributes ... },
    "mimeType": "application/pdf"
  }

IAM:
  - dynamodb:GetItem on DocumentMetadata
  - s3:GetObject on bucket (for presigned URL generation)
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


def _normalize_item(item: dict) -> dict:
    normalized = {}
    for key, value in item.items():
        if isinstance(value, Decimal):
            normalized[key] = int(value) if value % 1 == 0 else float(value)
        else:
            normalized[key] = value
    return normalized


def _parse_s3_location(file_path: str) -> tuple[str, str]:
    """Parse S3 bucket and key from https URL, s3:// URI, or key-only path."""
    file_path = (file_path or "").strip()
    if not file_path:
        raise ValueError("FilePath is empty")

    if file_path.startswith("s3://"):
        parsed = urlparse(file_path)
        bucket = parsed.netloc
        key = unquote(parsed.path.lstrip("/"))
        return bucket, key

    if file_path.startswith("http://") or file_path.startswith("https://"):
        parsed = urlparse(file_path)
        host = parsed.netloc

        virtual_host = re.match(
            r"^(.+?)\.s3[.-][a-z0-9-]+\.amazonaws\.com$",
            host,
            re.IGNORECASE,
        )
        if virtual_host:
            bucket = virtual_host.group(1)
            key = unquote(parsed.path.lstrip("/"))
            return bucket, key

        path_match = re.match(r"^/([^/]+)/(.+)$", parsed.path)
        if path_match and "amazonaws.com" in host:
            bucket = path_match.group(1)
            key = unquote(path_match.group(2))
            return bucket, key

        raise ValueError(f"Unsupported S3 URL format: {file_path}")

    return DEFAULT_BUCKET, file_path.lstrip("/")


def get_document_preview(document_id: str) -> dict:
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

    metadata = _normalize_item(item)
    file_path = metadata.get("FilePath") or metadata.get("filePath") or ""

    if not file_path:
        raise ValueError("Document has no FilePath")

    bucket, key = _parse_s3_location(file_path)
    mime_type = metadata.get("MimeType") or metadata.get("mimeType") or "application/pdf"

    try:
        preview_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=PRESIGNED_EXPIRY,
        )
    except ClientError as exc:
        raise ValueError(f"Could not generate preview URL: {exc}") from exc

    return {
        "documentId": document_id,
        "previewUrl": preview_url,
        "mimeType": mime_type,
        "metadata": metadata,
    }


def lambda_handler(event, context):
    request_context = event.get("requestContext") or {}
    http_method = request_context.get("http", {}).get("method") or event.get("httpMethod")

    if http_method == "OPTIONS":
        return _response(200, {"message": "OK"})

    try:
        payload = _parse_event_body(event)
        document_id = payload.get("documentId") or payload.get("DocumentId") or ""

        result = get_document_preview(document_id)
        return _response(200, result)

    except ValueError as exc:
        return _response(404, {"error": str(exc)})

    except Exception as exc:
        return _response(500, {"error": str(exc)})
