import json
import os
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

AWS_REGION = os.environ.get(
    "AWS_REGION",
    "us-east-1"
)

DYNAMODB_TABLE = os.environ.get(
    "DYNAMODB_TABLE",
    "DocumentMetadata"
)

MAX_RESULTS = int(
    os.environ.get(
        "SEARCH_MAX_RESULTS",
        "200"
    )
)

FILTER_MAP = {
    "DocumentType": "DOCTYPE",
    "AccountNumber": "ACCOUNTNUMBER",
    "AccountHolderName": "ACCOUNTHOLDERNAME",
    "Branch": "BRANCH"
}

dynamodb = boto3.resource(
    "dynamodb",
    region_name=AWS_REGION
)

metadata_table = dynamodb.Table(
    DYNAMODB_TABLE
)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}


def _response(status_code: int, body: Any):

    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(
            body,
            default=_json_default
        ),
    }


def _json_default(value: Any):

    if isinstance(value, Decimal):

        if value % 1 == 0:
            return int(value)

        return float(value)

    raise TypeError()


def _parse_event_body(event: dict):

    body = event.get("body")

    if not body:
        return {}

    if isinstance(body, str):
        return json.loads(body)

    return body


def _normalize_item(item: dict):

    normalized = {}

    for key, value in item.items():

        if isinstance(value, Decimal):

            normalized[key] = (
                int(value)
                if value % 1 == 0
                else float(value)
            )

        else:
            normalized[key] = value

    return normalized

def search_documents(query, filter_key):

    query = (
        query or ""
    ).strip().lower()

    filter_key = (
        filter_key or ""
    ).strip()

    prefix = FILTER_MAP.get(
        filter_key
    )

    if not prefix:
        return []

    overloaded_key = (
        f"{prefix}#{query}"
    )

    response = metadata_table.query(
        IndexName="SearchPK-index",

        KeyConditionExpression=Key(
            "SearchPK"
        ).eq(
            overloaded_key
        ),

        Limit=MAX_RESULTS
    )

    items = response.get(
        "Items",
        []
    )

    results = []

    for item in items:

        # MAIN ITEM
        if "ReferenceDocumentId" not in item:

            results.append(
                _normalize_item(item)
            )

            continue

        # SEARCH ITEM
        document_id = item.get(
            "ReferenceDocumentId"
        )

        if not document_id:
            continue

        document_response = metadata_table.get_item(
            Key={
                "DocumentId": document_id
            }
        )

        document = document_response.get(
            "Item"
        )

        if document:

            results.append(
                _normalize_item(document)
            )

    return results

def lambda_handler(event, context):

    request_context = event.get(
        "requestContext"
    ) or {}

    if (
        request_context.get(
            "http",
            {}
        ).get(
            "method"
        ) == "OPTIONS"
        or event.get(
            "httpMethod"
        ) == "OPTIONS"
    ):

        return _response(
            200,
            {
                "message": "OK"
            }
        )

    try:

        payload = _parse_event_body(
            event
        )

        query = payload.get(
            "query",
            ""
        )

        filter_key = payload.get(
            "filter",
            ""
        )

        results = search_documents(
            query,
            filter_key
        )

        return _response(
            200,
            {
                "results": results,
                "count": len(results)
            }
        )

    except Exception as exc:

        return _response(
            500,
            {
                "error": str(exc)
            }
        )