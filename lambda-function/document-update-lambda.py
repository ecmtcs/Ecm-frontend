"""
AWS Lambda (Function URL): update editable document (business) metadata in DynamoDB.

Request (POST JSON):
  {
    "documentId": "<uuid>",
    "updates": { "AccountNumber": "123", "Branch": "Pune", ... }
  }

Only business/document fields are writable. System and internal fields
(DocumentId, FilePath, Creator, CreatedDate, Size, MimeType, DocumentTitle,
SearchPK, ReferenceDocumentId) are protected and silently ignored.

SearchPK (primary GSI key) is recomputed from the merged values so the document
stays searchable after an edit.

Response (200):
  { "documentId": "...", "updated": true, "metadata": { ...full item... } }

IAM:
  - dynamodb:GetItem, dynamodb:PutItem on DocumentMetadata
"""

import json
import os
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "DocumentMetadata")

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
metadata_table = dynamodb.Table(DYNAMODB_TABLE)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}

# Keys the client may never overwrite via this endpoint.
PROTECTED_KEYS = {
    "DocumentId",
    "FilePath",
    "filePath",
    "ArchivalFilePath",
    "archivalFilePath",
    "Creator",
    "CreatedDate",
    "Size",
    "MimeType",
    "DocumentTitle",
    "SearchPK",
    "ReferenceDocumentId",
}

# GSI overloading priority (mirrors the upload Lambda).
_SEARCH_PK_PRIORITY = (
    ("DocumentType", "DOCTYPE"),
    ("AccountNumber", "ACCOUNTNUMBER"),
    ("AccountHolderName", "ACCOUNTHOLDERNAME"),
    ("Branch", "BRANCH"),
)


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
    return {
        key: (int(value) if value % 1 == 0 else float(value))
        if isinstance(value, Decimal)
        else value
        for key, value in item.items()
    }


def _recompute_search_pk(item: dict) -> None:
    for field, prefix in _SEARCH_PK_PRIORITY:
        value = item.get(field)
        if value not in (None, ""):
            item["SearchPK"] = f"{prefix}#{str(value).strip().lower()}"
            return


def update_document(document_id: str, updates: dict) -> dict:
    document_id = (document_id or "").strip()
    if not document_id:
        raise ValueError("documentId is required")
    if not isinstance(updates, dict) or not updates:
        raise ValueError("updates object is required")

    response = metadata_table.get_item(Key={"DocumentId": document_id})
    item = response.get("Item")
    if not item:
        raise ValueError(f"Document not found: {document_id}")
    if item.get("ReferenceDocumentId"):
        raise ValueError("documentId must be the main document UUID, not a search index item")

    applied = False
    for key, value in updates.items():
        if key in PROTECTED_KEYS:
            continue
        text = "" if value is None else str(value).strip()
        if text == "":
            item.pop(key, None)
        else:
            item[key] = text
        applied = True

    if not applied:
        raise ValueError("No editable fields supplied")

    _recompute_search_pk(item)

    try:
        metadata_table.put_item(
            Item=item,
            ConditionExpression="attribute_exists(DocumentId)",
        )
    except ClientError as exc:
        raise ValueError(f"Could not update document: {exc}") from exc

    return {
        "documentId": document_id,
        "updated": True,
        "metadata": _normalize_item(item),
    }


def lambda_handler(event, context):
    request_context = event.get("requestContext") or {}
    http_method = request_context.get("http", {}).get("method") or event.get("httpMethod")

    if http_method == "OPTIONS":
        return _response(200, {"message": "OK"})

    try:
        payload = _parse_event_body(event)
        document_id = payload.get("documentId") or payload.get("DocumentId") or ""
        updates = payload.get("updates") or {}

        result = update_document(document_id, updates)
        return _response(200, result)

    except ValueError as exc:
        return _response(404, {"error": str(exc)})

    except Exception as exc:
        return _response(500, {"error": str(exc)})
