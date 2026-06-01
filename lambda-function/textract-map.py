# import boto3
# import json
# import urllib.parse
# import re

# textract = boto3.client('textract')

# def lambda_handler(event, context):
#     # Get the S3 bucket and file name from the SQS message
#     for record in event['Records']:
#         body = json.loads(record['body'])
#         s3_info = body['Records'][0]['s3']
#         bucket_name = s3_info['bucket']['name']
        
#         # FIX 1: URL-decode the S3 key so spaces and special characters are handled correctly
#         raw_key = s3_info['object']['key']
#         file_name = urllib.parse.unquote_plus(raw_key)
        
#         print(f"Asking Textract to read: {file_name} from {bucket_name}")
        
#         # FIX 2: Sanitize the JobTag
#         # Replace slashes and invalid characters with underscores, and limit to 64 characters
#         safe_job_tag = re.sub(r'[^a-zA-Z0-9_:\.\-]', '_', file_name)
#         safe_job_tag = safe_job_tag[-64:] # Ensure it doesn't exceed the 64-character limit
        
#         # Start the Textract Job
#         response = textract.start_document_analysis(
#             DocumentLocation={
#                 'S3Object': {
#                     'Bucket': bucket_name,
#                     'Name': file_name
#                 }
#             },
#             FeatureTypes=[
#                 'LAYOUT',
#                 'TABLES'
#             ],
#             NotificationChannel={
#                 'SNSTopicArn': 'arn:aws:sns:us-east-1:816344831016:Textract-Finished-Topic',
#                 'RoleArn': 'arn:aws:iam::816344831016:role/Textract-SNS-Publish-Role-Map'
#             },
#             JobTag=safe_job_tag
#         )
        
#         print(f"Started Job ID: {response['JobId']}")
        
#     return {"statusCode": 200, "body": "Successfully started Textract."}
import boto3
import json
import urllib.parse
import re
import uuid
from datetime import datetime

textract = boto3.client('textract')

# ✅ DynamoDB setup
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('DocumentTracker')

def lambda_handler(event, context):

    print("FULL EVENT:", json.dumps(event))
    
    for record in event.get('Records', []):
        
        body = json.loads(record.get('body', '{}'))

        if 'Records' not in body:
            print("Skipping non-S3 message:", body)
            continue

        s3_info = body['Records'][0]['s3']
        bucket_name = s3_info['bucket']['name']

        raw_key = s3_info['object']['key']
        original_filename = urllib.parse.unquote_plus(raw_key)

        print(f"Processing file: {original_filename} from {bucket_name}")

        # ✅ UUID stored inside DocumentId
        document_uuid = str(uuid.uuid4())

        creator = "system"  # customize if needed
        timestamp = datetime.utcnow().isoformat()

        # 🟢 STATE 1: UPLOADED
        
        # 🟢 STATE 1: UPLOADED
        table.put_item(
            Item={
                'DocumentId': document_uuid,
                'EventTime': datetime.utcnow().isoformat(),  # ✅ sort key
                'OriginalFileName': original_filename,
                'Status': 'UPLOADED',
                'Creator': creator
            }
        )


        print(f"✅ UPLOADED logged: {document_uuid}")

        # ✅ Use same UUID as JobTag
        safe_job_tag = re.sub(r'[^a-zA-Z0-9_:\.\-]', '_', document_uuid)

        # ✅ Start Textract
        response = textract.start_document_analysis(
            DocumentLocation={
                'S3Object': {
                    'Bucket': bucket_name,
                    'Name': original_filename
                }
            },
            FeatureTypes=['LAYOUT', 'TABLES'],
            NotificationChannel={
                'SNSTopicArn': 'arn:aws:sns:us-east-1:816344831016:Textract-Finished-Topic',
                'RoleArn': 'arn:aws:iam::816344831016:role/Textract-SNS-Publish-Role-Map'
            },
            JobTag=safe_job_tag
        )

        print(f"✅ Textract started: {response['JobId']}")

        
        # 🔵 STATE 2: PROCESSING
        table.put_item(
            Item={
                'DocumentId': document_uuid,
                'EventTime': datetime.utcnow().isoformat(),
                'OriginalFileName': original_filename,
                'Status': 'PROCESSING',
                'Creator': creator
            }
        )


        print(f"✅ PROCESSING updated: {document_uuid}")

    return {
        "statusCode": 200,
        "body": "Textract job triggered successfully"
    }
