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
  1. Copy source object to Archival/<DocumentType>/<uuid>.<ext> (UUID-only object name)
  2. PutItem into DocumentMetadata (partition key DocumentId = uuid)
     - All CSV columns except source FilePath
     - FilePath attribute = destination S3 URL (replaces source path)
     - DocumentId = generated uuid
     - System metadata: DocumentTitle, Creator, CreatedDate, Size, MimeType

Response (JSON array, one item per row):
  [
    {
      "documentId": "...",
      "uuid": "...",
      "sourceKey": "Staging/file.pdf",
      "destinationKey": "Archival/<DocumentType>/<uuid>.pdf",
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
from datetime import datetime, timezone
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
    Archival object key uses only the document UUID (plus extension for content handling).
    Original filename is stored in DynamoDB as DocumentTitle.
    """
    filename = os.path.basename(source_key) or "file"
    prefix = ARCHIVAL_PREFIX.rstrip("/")
    type_folder = sanitize_document_type_folder(document_type)

    _, ext = os.path.splitext(filename)
    archival_name = f"{file_uuid}{ext}" if ext else file_uuid

    return f"{prefix}/{type_folder}/{archival_name}"


def get_source_object_metadata(source_bucket: str, source_key: str) -> dict[str, Any]:
    """Read size and Content-Type from the source S3 object before copy."""
    try:
        response = s3.head_object(Bucket=source_bucket, Key=source_key)
        content_type = response.get("ContentType") or "application/octet-stream"
        size = response.get("ContentLength")
        return {
            "size": int(size) if size is not None else None,
            "mime_type": str(content_type).strip() or "application/octet-stream",
        }
    except ClientError:
        return {"size": None, "mime_type": None}


def extract_document_title(source_key: str) -> str:
    return os.path.basename(source_key) or "file"


def resolve_creator(row: dict) -> str:
    creator = _string_value(row.get("Creator")) or _string_value(row.get("creator"))
    if creator:
        return creator

    name = _string_value(row.get("CreatorName")) or _string_value(row.get("creatorName"))
    email = _string_value(row.get("CreatorEmail")) or _string_value(row.get("creatorEmail"))
    if name and email:
        return f"{name} ({email})"
    if name:
        return name
    if email:
        return email

    return "Unknown"


def utc_created_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()




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


# GSI overloading: SearchPK-index partition key SearchPK = PREFIX#value
_SEARCH_GSI_FIELDS = (
    ("DocumentType", "DOCTYPE"),
    ("AccountNumber", "ACCOUNTNUMBER"),
    ("AccountHolderName", "ACCOUNTHOLDERNAME"),
    ("Branch", "BRANCH"),
)


def _enrich_gsi_search_keys(item: dict) -> dict:
    """
    True GSI overloading.

    Priority:
      1. DocumentType
      2. AccountNumber
      3. AccountHolderName
      4. Branch

    Only ONE SearchPK is stored per item.
    """

    if item.get("DocumentType"):
        item["SearchPK"] = (
            f"DOCTYPE#{str(item['DocumentType']).strip().lower()}"
        )

    elif item.get("AccountNumber"):
        item["SearchPK"] = (
            f"ACCOUNTNUMBER#{str(item['AccountNumber']).strip().lower()}"
        )

    elif item.get("AccountHolderName"):
        item["SearchPK"] = (
            f"ACCOUNTHOLDERNAME#{str(item['AccountHolderName']).strip().lower()}"
        )

    elif item.get("Branch"):
        item["SearchPK"] = (
            f"BRANCH#{str(item['Branch']).strip().lower()}"
        )

    return item


_RESERVED_ROW_KEYS = {
    "documentid",
    "document id",
    "creator",
    "creatorname",
    "creatoremail",
    "documenttitle",
    "createddate",
    "size",
    "mimetype",
}


def build_dynamodb_item(
    row: dict,
    document_id: str,
    destination_url: str,
    *,
    document_title: str,
    creator: str,
    created_date: str,
    size_bytes: int | None,
    mime_type: str | None,
) -> dict:
    """
    Build DocumentMetadata item:
      - DocumentId (partition key) = uuid
      - FilePath = destination S3 URL (not the CSV source path)
      - System properties: DocumentTitle, Creator, CreatedDate, Size, MimeType
      - All other CSV columns except source FilePath and reserved system keys
      - SearchPK for GSI search (SearchPK-index)
    """
    item: dict[str, Any] = {
        "DocumentId": document_id,
        "FilePath": destination_url,
        "DocumentTitle": document_title,
        "Creator": creator,
        "CreatedDate": created_date,
    }

    if size_bytes is not None:
        item["Size"] = size_bytes

    if mime_type:
        item["MimeType"] = mime_type

    for key, value in row.items():
        if _is_file_path_column(key):
            continue

        normalized = _normalize_header(key).replace(" ", "")
        if normalized in _RESERVED_ROW_KEYS:
            continue

        text = _string_value(value)
        if text is None:
            continue

        item[key] = text

    return _enrich_gsi_search_keys(item)



def save_metadata_to_dynamodb(
    row: dict,
    document_id: str,
    destination_url: str,
    *,
    document_title: str,
    creator: str,
    created_date: str,
    size_bytes: int | None,
    mime_type: str | None,
):

    main_item = build_dynamodb_item(
        row,
        document_id,
        destination_url,
        document_title=document_title,
        creator=creator,
        created_date=created_date,
        size_bytes=size_bytes,
        mime_type=mime_type,
    )

    # MAIN DOCUMENT ITEM
    metadata_table.put_item(
        Item=main_item
    )

    searchable_fields = [
        ("AccountNumber", "ACCOUNTNUMBER"),
        ("AccountHolderName", "ACCOUNTHOLDERNAME"),
        ("Branch", "BRANCH"),
    ]

    for field, prefix in searchable_fields:

        value = row.get(field)

        if not value:
            continue

        normalized = (
            str(value)
            .strip()
            .lower()
        )

        search_item = {

            "DocumentId":
                f"SEARCH#{document_id}#{prefix}",

            "ReferenceDocumentId":
                document_id,

            "SearchPK":
                f"{prefix}#{normalized}"
        }

        metadata_table.put_item(
            Item=search_item
        )

    return main_item


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

        object_metadata = get_source_object_metadata(source_bucket, source_key)
        document_title = extract_document_title(source_key)
        creator = resolve_creator(row)
        created_date = utc_created_timestamp()

        copy_object(source_bucket, source_key, dest_bucket, dest_key)

        new_s3_path = build_s3_url(dest_bucket, dest_key)

        try:
            dynamo_item = save_metadata_to_dynamodb(
                row,
                file_uuid,
                new_s3_path,
                document_title=document_title,
                creator=creator,
                created_date=created_date,
                size_bytes=object_metadata.get("size"),
                mime_type=object_metadata.get("mime_type"),
            )
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
            "documentTitle": document_title,
            "creator": creator,
            "createdDate": created_date,
            "size": object_metadata.get("size"),
            "mimeType": object_metadata.get("mime_type"),
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