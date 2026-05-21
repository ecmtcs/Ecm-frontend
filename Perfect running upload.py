"""
AWS Lambda: copy S3 objects from CSV FilePath values into Archival/, then save metadata to DynamoDB.

Expected request body (from frontend):
  {
    "rows": [
      {
        "FilePath": "<source-s3-url-or-key>",
        "DocumentType": "Contract",
        "AccountNumber": "...",
        ...
      },
      ...
    ]
  }

Per row:
  1. Copy source object to Archival/<DocumentType>/<uuid>/<filename>
  2. PutItem into DocumentMetadata (partition key DocumentId = uuid)
     - All CSV columns except source FilePath
     - FilePath attribute = destination S3 URL (replaces source path)
     - DocumentId = generated uuid

Response (JSON array, one item per row):
  [
    {
      "documentId": "...",
      "uuid": "...",
      "sourceKey": "Staging/file.pdf",
      "destinationKey": "Archival/<DocumentType>/<uuid>/file.pdf",
      "newS3Path": "https://.../Archival/...",
      "documentType": "Contract",
      "status": "copied",
      "metadataSaved": true
    },
    ...
  ]

IAM (attach to ecm-uploadfiles-role-641px569):
  - s3:GetObject on aaas-content-vault-2026/*
  - s3:PutObject, s3:DeleteObject (for copy) on aaas-content-vault-2026/Archival/*
  - dynamodb:PutItem on table DocumentMetadata
"""

import json
import os
import re
import uuid
import urllib.parse
from typing import Any

import boto3
from botocore.exceptions import ClientError

DEFAULT_BUCKET = os.environ.get("S3_BUCKET", "aaas-content-vault-2026")
ARCHIVAL_PREFIX = os.environ.get("ARCHIVAL_PREFIX", "Archival/")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "DocumentMetadata")

FILE_PATH_KEYS = {
    "filepath",
    "file path",
    "file_path",
    "documentpath",
    "document path",
}

s3 = boto3.client("s3", region_name=AWS_REGION)
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
metadata_table = dynamodb.Table(DYNAMODB_TABLE)

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
        "body": json.dumps(body),
    }


def _parse_event_body(event: dict) -> dict:
    if not event:
        return {}

    if "rows" in event:
        return event

    body = event.get("body")
    if body is None:
        return {}

    if isinstance(body, str):
        if not body.strip():
            return {}
        return json.loads(body)

    if isinstance(body, dict):
        return body

    return {}


def extract_source_key(file_path: str, default_bucket: str = DEFAULT_BUCKET) -> tuple[str, str]:
    """
    Parse FilePath from CSV into (bucket, object_key).

    Supports:
      - https://bucket.s3.region.amazonaws.com/Staging/file.pdf
      - https://s3.region.amazonaws.com/bucket/Staging/file.pdf
      - s3://bucket/Staging/file.pdf
      - Staging/file.pdf
    """
    value = (file_path or "").strip().strip('"').strip("'")
    if not value:
        raise ValueError("FilePath is empty")

    if value.startswith("s3://"):
        without_scheme = value[5:]
        slash = without_scheme.find("/")
        if slash == -1:
            raise ValueError(f"Invalid s3 URI: {value}")
        bucket = without_scheme[:slash]
        key = without_scheme[slash + 1 :]
        return bucket, key

    if value.startswith(("http://", "https://")):
        parsed = urllib.parse.urlparse(value)
        host = (parsed.netloc or "").lower()
        key = urllib.parse.unquote((parsed.path or "").lstrip("/"))

        if not key:
            raise ValueError(f"Could not extract object key from URL: {value}")

        # Path-style: https://s3.us-east-1.amazonaws.com/bucket/key
        if host.startswith("s3.") or host.startswith("s3-"):
            parts = key.split("/", 1)
            if len(parts) < 2:
                raise ValueError(f"Invalid path-style S3 URL: {value}")
            return parts[0], parts[1]

        # Virtual-hosted: https://bucket.s3.region.amazonaws.com/key
        if ".s3." in host:
            bucket = host.split(".s3.", 1)[0]
            return bucket, key

        # Generic HTTPS URL — assume default bucket, path is key
        return default_bucket, key

    # Bare object key
    return default_bucket, value.lstrip("/")


def sanitize_document_type_folder(document_type: str) -> str:
    """Turn DocumentType into a safe S3 folder name."""
    name = (document_type or "").strip()
    if not name:
        raise ValueError("DocumentType is required")

    name = re.sub(r"[/\\]+", "-", name)
    name = re.sub(r"\s+", " ", name).strip()

    if not name:
        raise ValueError("DocumentType is invalid")

    return name


def build_destination_key(source_key: str, file_uuid: str, document_type: str) -> str:
    """
    Archival layout: Archival/<DocumentType>/<uuid>/<filename>
    S3 creates folder prefixes automatically when objects are copied.
    """
    filename = os.path.basename(source_key) or "file"
    prefix = ARCHIVAL_PREFIX.rstrip("/")
    type_folder = sanitize_document_type_folder(document_type)
    return f"{prefix}/{type_folder}/{file_uuid}/{filename}"


def build_s3_url(bucket: str, key: str) -> str:
    encoded_key = urllib.parse.quote(key, safe="/")
    return f"https://{bucket}.s3.{AWS_REGION}.amazonaws.com/{encoded_key}"


def copy_object(source_bucket: str, source_key: str, dest_bucket: str, dest_key: str) -> None:
    copy_source = {"Bucket": source_bucket, "Key": source_key}
    s3.copy_object(
        CopySource=copy_source,
        Bucket=dest_bucket,
        Key=dest_key,
    )


def _normalize_header(key: str) -> str:
    return re.sub(r"\s+", " ", (key or "").strip()).lower()


def _is_file_path_column(key: str) -> bool:
    return _normalize_header(key) in FILE_PATH_KEYS


def _string_value(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def build_dynamodb_item(row: dict, document_id: str, destination_url: str) -> dict:
    """
    Build DocumentMetadata item:
      - DocumentId (partition key) = uuid
      - FilePath = destination S3 URL (not the CSV source path)
      - All other CSV columns except source FilePath
    """
    item: dict[str, str] = {
        "DocumentId": document_id,
        "FilePath": destination_url,
    }

    for key, value in row.items():
        if _is_file_path_column(key):
            continue

        text = _string_value(value)
        if text is None:
            continue

        # Do not overwrite partition key or destination path
        if _normalize_header(key) in {"documentid", "document id"}:
            continue

        item[key] = text

    return item


def save_metadata_to_dynamodb(row: dict, document_id: str, destination_url: str) -> dict:
    item = build_dynamodb_item(row, document_id, destination_url)
    metadata_table.put_item(Item=item)
    return item


def process_row(row: dict, index: int) -> dict:
    file_path = row.get("FilePath") or row.get("filepath") or row.get("file_path")
    document_type = row.get("DocumentType") or row.get("documenttype") or row.get("document_type") or ""

    if not file_path:
        return {
            "index": index,
            "status": "error",
            "error": "Missing FilePath",
            "documentType": document_type,
        }

    if not (document_type or "").strip():
        return {
            "index": index,
            "status": "error",
            "error": "Missing DocumentType",
            "filePath": file_path,
        }

    try:
        source_bucket, source_key = extract_source_key(file_path)
        file_uuid = str(uuid.uuid4())
        dest_bucket = DEFAULT_BUCKET
        type_folder = sanitize_document_type_folder(document_type)
        dest_key = build_destination_key(source_key, file_uuid, document_type)

        copy_object(source_bucket, source_key, dest_bucket, dest_key)

        new_s3_path = build_s3_url(dest_bucket, dest_key)

        try:
            dynamo_item = save_metadata_to_dynamodb(row, file_uuid, new_s3_path)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "ClientError")
            message = exc.response.get("Error", {}).get("Message", str(exc))
            return {
                "index": index,
                "status": "error",
                "error": f"DynamoDB {code}: {message}",
                "s3Copied": True,
                "uuid": file_uuid,
                "documentId": file_uuid,
                "newS3Path": new_s3_path,
                "destinationKey": dest_key,
                "filePath": file_path,
                "documentType": document_type,
            }

        return {
            "index": index,
            "uuid": file_uuid,
            "documentId": file_uuid,
            "sourceKey": source_key,
            "sourceBucket": source_bucket,
            "destinationKey": dest_key,
            "destinationBucket": dest_bucket,
            "documentType": document_type,
            "documentTypeFolder": type_folder,
            "newS3Path": new_s3_path,
            "metadataSaved": True,
            "dynamoItem": dynamo_item,
            "status": "copied",
        }
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "ClientError")
        message = exc.response.get("Error", {}).get("Message", str(exc))
        return {
            "index": index,
            "status": "error",
            "error": f"{code}: {message}",
            "filePath": file_path,
            "documentType": document_type,
        }
    except Exception as exc:
        return {
            "index": index,
            "status": "error",
            "error": str(exc),
            "filePath": file_path,
            "documentType": document_type,
        }


def lambda_handler(event: dict, context: Any) -> dict:
    # CORS preflight for Lambda Function URL
    request_context = event.get("requestContext") or {}
    if request_context.get("http", {}).get("method") == "OPTIONS" or event.get("httpMethod") == "OPTIONS":
        return _response(200, {"message": "OK"})

    try:
        payload = _parse_event_body(event)
        rows = payload.get("rows")

        if not isinstance(rows, list) or len(rows) == 0:
            return _response(400, {"error": "Request body must include a non-empty 'rows' array."})

        results = [process_row(row, i) for i, row in enumerate(rows)]

        has_errors = any(r.get("status") == "error" for r in results)
        status_code = 207 if has_errors else 200

        return _response(status_code, results)

    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON in request body."})
    except Exception as exc:
        return _response(500, {"error": str(exc)})