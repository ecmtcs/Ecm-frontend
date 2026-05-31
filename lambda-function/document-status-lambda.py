"""
AWS Lambda (Function URL): fetch document processing status from DocumentTracker.

DocumentTracker schema (from textract-map.py / process-and-vectorize-map.py):
  - DocumentId      (partition key)
  - EventTime       (ISO-8601 UTC string)
  - OriginalFileName
  - Status          (UPLOADED | PROCESSING | INDEXED | FAILED)
  - Creator

GET /document-status?limit=25&page=0

Response:
{
  "items": [...],
  "count": 25,
  "totalCount": 150,
  "page": 0,
  "hasMore": true,
  "lastEvaluatedKey": null,
  "summary": {
    "totalFiles": 150,
    "totalProcessing": 20,
    "totalCompleted": 120,
    "totalFailed": 10,
    "statusDistribution": { "INDEXED": 120, "PROCESSING": 15, ... }
  }
}

Note: DocumentTracker has only DocumentId as partition key (no EventTime GSI).
A table Scan is required to list all documents and sort by EventTime descending.
Scan is capped by MAX_SCAN_ITEMS (default 5000) for safety.
"""

import json
import logging
import os
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qs

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
TRACKER_TABLE = os.environ.get("TRACKER_TABLE", "DocumentTracker")
DEFAULT_PAGE_SIZE = int(os.environ.get("DEFAULT_PAGE_SIZE", "25"))
MAX_PAGE_SIZE = int(os.environ.get("MAX_PAGE_SIZE", "100"))
MAX_SCAN_ITEMS = int(os.environ.get("MAX_SCAN_ITEMS", "5000"))

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
tracker_table = dynamodb.Table(TRACKER_TABLE)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
}

PROJECTION = "DocumentId, EventTime, OriginalFileName, Creator, #status"
PROJECTION_NAMES = {"#status": "Status"}

COMPLETED_STATUSES = frozenset({"INDEXED", "COMPLETED"})
PROCESSING_STATUSES = frozenset({"UPLOADED", "PROCESSING"})
FAILED_STATUSES = frozenset({"FAILED"})


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


def _normalize_dynamo_item(item: dict) -> dict:
    normalized = {}
    for key, value in item.items():
        if isinstance(value, Decimal):
            normalized[key] = int(value) if value % 1 == 0 else float(value)
        else:
            normalized[key] = value
    return normalized


def _parse_query_params(event: dict) -> dict:
    params = event.get("queryStringParameters") or {}
    if params:
        return params

    raw_query = event.get("rawQueryString") or ""
    if not raw_query:
        return {}

    parsed = parse_qs(raw_query, keep_blank_values=True)
    return {key: values[0] for key, values in parsed.items() if values}


def _safe_int(value: Any, default: int, minimum: int = 0, maximum: int | None = None) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default

    if number < minimum:
        return minimum
    if maximum is not None and number > maximum:
        return maximum
    return number


def _scan_tracker_items() -> list[dict]:
    items: list[dict] = []
    last_key = None

    while len(items) < MAX_SCAN_ITEMS:
        scan_kwargs: dict[str, Any] = {
            "ProjectionExpression": PROJECTION,
            "ExpressionAttributeNames": PROJECTION_NAMES,
        }

        if last_key:
            scan_kwargs["ExclusiveStartKey"] = last_key

        response = tracker_table.scan(**scan_kwargs)
        batch = [_normalize_dynamo_item(item) for item in response.get("Items", [])]
        items.extend(batch)

        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break

    if len(items) >= MAX_SCAN_ITEMS and last_key:
        logger.warning(
            "DocumentTracker scan reached MAX_SCAN_ITEMS=%s; results may be truncated.",
            MAX_SCAN_ITEMS,
        )

    return items


def _format_row(item: dict) -> dict:
    event_time = str(item.get("EventTime") or "")
    status = str(item.get("Status") or "UNKNOWN")
    filename = item.get("OriginalFileName") or item.get("DocumentId") or "—"

    return {
        "documentId": item.get("DocumentId") or "—",
        "filename": filename,
        "creator": item.get("Creator") or "—",
        "date": event_time[:10] if len(event_time) >= 10 else "—",
        "timestamp": event_time or "—",
        "status": status,
    }


def _compute_summary(items: list[dict]) -> dict:
    distribution: dict[str, int] = {}
    total_processing = 0
    total_completed = 0
    total_failed = 0

    for item in items:
        status = str(item.get("Status") or "UNKNOWN").upper()
        distribution[status] = distribution.get(status, 0) + 1

        if status in COMPLETED_STATUSES:
            total_completed += 1
        elif status in FAILED_STATUSES:
            total_failed += 1
        elif status in PROCESSING_STATUSES:
            total_processing += 1

    return {
        "totalFiles": len(items),
        "totalProcessing": total_processing,
        "totalCompleted": total_completed,
        "totalFailed": total_failed,
        "statusDistribution": distribution,
    }


def get_document_status_report(limit: int = DEFAULT_PAGE_SIZE, page: int = 0) -> dict:
    all_items = _scan_tracker_items()
    all_items.sort(key=lambda item: str(item.get("EventTime") or ""), reverse=True)

    total_count = len(all_items)
    start = page * limit
    end = start + limit
    page_items = all_items[start:end]

    return {
        "items": [_format_row(item) for item in page_items],
        "count": len(page_items),
        "totalCount": total_count,
        "page": page,
        "hasMore": end < total_count,
        "lastEvaluatedKey": {"page": page + 1} if end < total_count else None,
        "summary": _compute_summary(all_items),
    }


def lambda_handler(event, context):
    request_context = event.get("requestContext") or {}
    http_method = request_context.get("http", {}).get("method") or event.get("httpMethod")

    logger.info("Request method=%s", http_method)

    if http_method == "OPTIONS":
        return _response(200, {"message": "OK"})

    if http_method != "GET":
        return _response(405, {"error": "Method not allowed. Use GET."})

    try:
        params = _parse_query_params(event)
        limit = _safe_int(params.get("limit"), DEFAULT_PAGE_SIZE, minimum=1, maximum=MAX_PAGE_SIZE)
        page = _safe_int(params.get("page"), 0, minimum=0)

        if params.get("lastEvaluatedKey"):
            try:
                cursor = json.loads(params["lastEvaluatedKey"])
                if isinstance(cursor, dict) and "page" in cursor:
                    page = _safe_int(cursor["page"], page, minimum=0)
            except json.JSONDecodeError:
                logger.warning("Invalid lastEvaluatedKey payload ignored.")

        result = get_document_status_report(limit=limit, page=page)
        logger.info(
            "Returned page=%s count=%s totalCount=%s",
            result["page"],
            result["count"],
            result["totalCount"],
        )
        return _response(200, result)

    except ClientError as exc:
        logger.exception("DynamoDB error")
        return _response(500, {"error": "Failed to read document status records."})

    except Exception as exc:
        logger.exception("Unhandled error")
        return _response(500, {"error": str(exc)})
