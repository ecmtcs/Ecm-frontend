import boto3
import json

textract = boto3.client('textract')

def lambda_handler(event, context):
    # Get the S3 bucket and file name from the SQS message
    for record in event['Records']:
        body = json.loads(record['body'])
        s3_info = body['Records'][0]['s3']
        bucket_name = s3_info['bucket']['name']
        file_name = s3_info['object']['key']
        
        print(f"Asking Textract to read: {file_name} from {bucket_name}")
        
        # Start the Textract Job
        # response = textract.start_document_analysis(
        #     DocumentLocation={'S3Object': {'Bucket': bucket_name, 'Name': file_name}},
        #     FeatureTypes=['LAYOUT', 'TABLES'],
        #     NotificationChannel={
        #         'SNSTopicArn': 'arn:aws:sns:us-east-1:816344831016:Textract-Finished-Topic', # <-- PASTE YOUR SNS ARN HERE
        #         'RoleArn': 'arn:aws:iam::816344831016:role/Textract-SNS-Publish-Role-Map' # Textract needs a basic role to publish to SNS
        #     }
        # )
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

    JobTag=file_name
)
        print(f"Started Job ID: {response['JobId']}")
        
    return {"statusCode": 200, "body": "Successfully started Textract."}