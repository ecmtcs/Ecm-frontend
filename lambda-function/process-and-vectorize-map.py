import boto3
import json
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth

# AWS Clients
textract = boto3.client('textract')
bedrock = boto3.client('bedrock-runtime')

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
    file_name = sns_message.get('JobTag', 'Unknown.pdf')

    job_id = sns_message['JobId']
    status = sns_message['Status']

    if status != 'SUCCEEDED':
        print("Textract failed.")
        return

    # Get Textract Output
    response = textract.get_document_analysis(JobId=job_id)

    extracted_text = ""

    for block in response['Blocks']:
        if block['BlockType'] == 'LINE':
            extracted_text += block['Text'] + " "

    # Small Chunk
    chunk = extracted_text[:500]

    print("Generating embedding from Bedrock...")

    # Generate Embedding
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

    # Build OpenSearch Document
    document = {
    "DocumentId": job_id,
    "FileName": file_name,
    "ChunkText": chunk,
    "embedding": vector_data
}

    # Save into OpenSearch
    response = os_client.index(
        index='document-chunks',
        body=document
    )

    print("SUCCESS!")
    print(response)

    return {
        "statusCode": 200,
        "body": "Success"
    }