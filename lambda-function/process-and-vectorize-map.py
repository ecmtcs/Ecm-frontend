# import boto3
# import json
# from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth

# # AWS Clients
# textract = boto3.client('textract')
# bedrock = boto3.client('bedrock-runtime')

# # OpenSearch Config
# host = 'm38olwm36ri9dw1uln47.us-east-1.aoss.amazonaws.com'
# region = 'us-east-1'
# service = 'aoss'

# # IAM Auth
# credentials = boto3.Session().get_credentials()
# auth = AWSV4SignerAuth(credentials, region, service)

# # OpenSearch Client
# os_client = OpenSearch(
#     hosts=[{'host': host, 'port': 443}],
#     http_auth=auth,
#     use_ssl=True,
#     verify_certs=True,
#     connection_class=RequestsHttpConnection
# )

# def lambda_handler(event, context):

#     sns_message = json.loads(event['Records'][0]['Sns']['Message'])
#     file_name = sns_message.get('JobTag', 'Unknown.pdf')

#     job_id = sns_message['JobId']
#     status = sns_message['Status']

#     if status != 'SUCCEEDED':
#         print("Textract failed.")
#         return

#     # Get Textract Output
#     response = textract.get_document_analysis(JobId=job_id)

#     extracted_text = ""

#     for block in response['Blocks']:
#         if block['BlockType'] == 'LINE':
#             extracted_text += block['Text'] + " "

#     # Small Chunk
#     chunk = extracted_text[:500]

#     print("Generating embedding from Bedrock...")

#     # Generate Embedding
#     bedrock_response = bedrock.invoke_model(
#         modelId='amazon.titan-embed-text-v2:0',
#         contentType='application/json',
#         accept='application/json',
#         body=json.dumps({
#             "inputText": chunk
#         })
#     )

#     vector_data = json.loads(
#         bedrock_response['body'].read()
#     )['embedding']

#     print(f"Embedding size: {len(vector_data)}")

#     # Build OpenSearch Document
#     document = {
#     "DocumentId": job_id,
#     "FileName": file_name,
#     "ChunkText": chunk,
#     "embedding": vector_data
# }

#     # Save into OpenSearch
#     response = os_client.index(
#         index='document-chunks',
#         body=document
#     )

#     print("SUCCESS!")
#     print(response)

#     return {
#         "statusCode": 200,
#         "body": "Success"
#     }
import boto3
import json
from datetime import datetime  # ✅ NEW
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth

# AWS Clients
textract = boto3.client('textract')
bedrock = boto3.client('bedrock-runtime')

# ✅ NEW: DynamoDB
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('DocumentTracker')

# OpenSearch Config
host = 'm38olwm36ri9dw1uln47.us-east-1.aoss.amazonaws.com'
region = 'us-east-1'
service = 'aoss'

# IAM Auth
credentials = boto3.Session().get_credentials()
auth = AWSV4SignerAuth(credentials, region, service)

# OpenSearch Client
os_client = OpenSearch(
    hosts=[{'host': host, 'port': 443}],
    http_auth=auth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection
)

def lambda_handler(event, context):

    sns_message = json.loads(event['Records'][0]['Sns']['Message'])

    # ✅ UUID passed via JobTag → this is your DocumentId
    document_id = sns_message.get('JobTag', 'UNKNOWN_ID')

    file_name = document_id  # optional reuse

    job_id = sns_message['JobId']
    status = sns_message['Status']

    # 🔴 STATE: FAILED (Textract failed)
    if status != 'SUCCEEDED':
        print("Textract failed.")

        table.update_item(
            Key={'DocumentId': document_id},
            UpdateExpression="SET #s = :status, EventTime = :time",
            ExpressionAttributeNames={'#s': 'Status'},
            ExpressionAttributeValues={
                ':status': 'FAILED',
                ':time': datetime.utcnow().isoformat()
            }
        )
        return

    # ✅ Get Textract Output
    response = textract.get_document_analysis(JobId=job_id)

    extracted_text = ""

    for block in response['Blocks']:
        if block['BlockType'] == 'LINE':
            extracted_text += block['Text'] + " "

    # Small Chunk
    chunk = extracted_text[:500]

    print("Generating embedding from Bedrock...")

    # ✅ Generate Embedding
    bedrock_response = bedrock.invoke_model(
        modelId='amazon.titan-embed-text-v2:0',
        contentType='application/json',
        accept='application/json',
        body=json.dumps({
            "inputText": chunk
        })
    )

    vector_data = json.loads(
        bedrock_response['body'].read()
    )['embedding']

    print(f"Embedding size: {len(vector_data)}")

    # ✅ OpenSearch Document
    document = {
        "DocumentId": job_id,
        "FileName": file_name,
        "ChunkText": chunk,
        "embedding": vector_data
    }

    try:
        # ✅ Save into OpenSearch
        response = os_client.index(
            index='document-chunks',
            body=document
        )

        print("SUCCESS!")
        print(response)

        # 🟢 STATE: INDEXED
        table.put_item(
            Item={
                'DocumentId': document_id,
                'EventTime': datetime.utcnow().isoformat(),
                # 'OriginalFileName': original_filename,
                'Status': 'INDEXED',
                'Creator': 'system'
            }
        )

        print(f"✅ INDEXED updated for {document_id}")

    except Exception as e:
        print("❌ OpenSearch or embedding failed:", str(e))

        # 🔴 STATE: FAILED (processing stage)
        table.put_item(
            Item={
                'DocumentId': document_id,
                'EventTime': datetime.utcnow().isoformat(),
                # 'OriginalFileName': original_filename,
                'Status': 'FAILED',
                'Creator': 'system'
            }
        )


        raise e

    return {
        "statusCode": 200,
        "body": "Success"
    }