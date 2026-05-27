import json
import boto3
import traceback

from opensearchpy import (
    OpenSearch,
    RequestsHttpConnection,
    AWSV4SignerAuth
)

# ==========================
# BEDROCK CLIENT
# ==========================

bedrock = boto3.client('bedrock-runtime')

# ==========================
# OPENSEARCH CONFIG
# ==========================

HOST = 'm38olwm36ri9dw1uln47.us-east-1.aoss.amazonaws.com'

REGION = 'us-east-1'
SERVICE = 'aoss'

INDEX_NAME = 'document-chunks'

# ==========================
# IAM AUTH
# ==========================

credentials = boto3.Session().get_credentials()

auth = AWSV4SignerAuth(
    credentials,
    REGION,
    SERVICE
)

# ==========================
# OPENSEARCH CLIENT
# ==========================

os_client = OpenSearch(
    hosts=[
        {
            'host': HOST,
            'port': 443
        }
    ],
    http_auth=auth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection
)

# ==========================
# MAIN FUNCTION
# ==========================

def lambda_handler(event, context):

    try:

        print("========== INCOMING EVENT ==========")
        print(json.dumps(event))

        # ==========================================
        # HANDLE HTTP METHOD
        # ==========================================

        http_method = event.get(
            'requestContext',
            {}
        ).get(
            'http',
            {}
        ).get(
            'method'
        )

        print(f"HTTP Method: {http_method}")

        # ==========================================
        # HANDLE GET REQUEST
        # ==========================================

        if http_method == 'GET':

            return build_response(
                200,
                {
                    "message":
                        "AI Search Lambda Running Successfully"
                }
            )

        # ==========================================
        # HANDLE OPTIONS REQUEST (CORS)
        # ==========================================

        if http_method == 'OPTIONS':

            return build_response(
                200,
                {
                    "message": "CORS OK"
                }
            )

        # ==========================================
        # READ REQUEST BODY SAFELY
        # ==========================================

        body = {}

        if 'body' in event:

            if isinstance(event['body'], str):

                body = json.loads(event['body'])

            else:

                body = event['body']

        print("Parsed Body:")
        print(body)

        user_query = body.get('query', '').strip()

        # ==========================================
        # VALIDATE QUERY
        # ==========================================

        if not user_query:

            return build_response(
                400,
                {
                    'message':
                        'Query is required'
                }
            )

        print(f"User Query: {user_query}")

        # ==========================================
        # GENERATE EMBEDDING
        # ==========================================

        print("Generating embedding using Bedrock...")

        bedrock_response = bedrock.invoke_model(

            modelId='amazon.titan-embed-text-v2:0',

            contentType='application/json',

            accept='application/json',

            body=json.dumps({
                "inputText": user_query
            })
        )

        response_body = json.loads(
            bedrock_response['body'].read()
        )

        embedding = response_body['embedding']

        print(
            f"Embedding Length: {len(embedding)}"
        )

        # ==========================================
        # VECTOR SEARCH QUERY
        # ==========================================

        search_query = {

            "size": 5,

            "query": {

                "knn": {

                    "embedding": {

                        "vector": embedding,

                        "k": 5
                    }
                }
            }
        }

        print("Executing OpenSearch Query...")

        # ==========================================
        # SEARCH OPENSEARCH
        # ==========================================

        response = os_client.search(
            index=INDEX_NAME,
            body=search_query
        )

        print("OpenSearch Response:")
        print(json.dumps(response))

        hits = response['hits']['hits']

        results = []

        # ==========================================
        # FORMAT RESULTS
        # ==========================================

        for hit in hits:

            source = hit['_source']

            results.append({

                "DocumentId":
                    source.get('DocumentId'),

                "FileName":
                    source.get('FileName'),

                "ChunkText":
                    source.get('ChunkText'),

                "Score":
                    hit.get('_score')
            })

        print(f"Results Found: {len(results)}")

        # ==========================================
        # SUCCESS RESPONSE
        # ==========================================

        return build_response(
            200,
            {
                "query": user_query,
                "results_count": len(results),
                "results": results
            }
        )

    except Exception as e:

        print("========== ERROR ==========")

        print(str(e))

        traceback.print_exc()

        return build_response(
            500,
            {
                "message":
                    "Internal Server Error",

                "error":
                    str(e)
            }
        )

# ==========================
# RESPONSE BUILDER
# ==========================

def build_response(status_code, body):

    return {

        "statusCode": status_code,

        "headers": {

            "Content-Type":
                "application/json"
        },

        "body": json.dumps(body)
    }