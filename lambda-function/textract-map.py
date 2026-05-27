import boto3
import json
import urllib.parse
import re

textract = boto3.client('textract')

def lambda_handler(event, context):
    # Get the S3 bucket and file name from the SQS message
    for record in event['Records']:
        body = json.loads(record['body'])
        s3_info = body['Records'][0]['s3']
        bucket_name = s3_info['bucket']['name']
        
        # FIX 1: URL-decode the S3 key so spaces and special characters are handled correctly
        raw_key = s3_info['object']['key']
        file_name = urllib.parse.unquote_plus(raw_key)
        
        print(f"Asking Textract to read: {file_name} from {bucket_name}")
        
        # FIX 2: Sanitize the JobTag
        # Replace slashes and invalid characters with underscores, and limit to 64 characters
        safe_job_tag = re.sub(r'[^a-zA-Z0-9_:\.\-]', '_', file_name)
        safe_job_tag = safe_job_tag[-64:] # Ensure it doesn't exceed the 64-character limit
        
        # Start the Textract Job
        response = textract.start_document_analysis(
            DocumentLocation={
                'S3Object': {
                    'Bucket': bucket_name,
                    'Name': file_name
                }
            },
            FeatureTypes=[
                'LAYOUT',
                'TABLES'
            ],
            NotificationChannel={
                'SNSTopicArn': 'arn:aws:sns:us-east-1:816344831016:Textract-Finished-Topic',
                'RoleArn': 'arn:aws:iam::816344831016:role/Textract-SNS-Publish-Role-Map'
            },
            JobTag=safe_job_tag
        )
        
        print(f"Started Job ID: {response['JobId']}")
        
    return {"statusCode": 200, "body": "Successfully started Textract."}