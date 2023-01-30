import urllib.request
import boto3
from PIL import Image

bucket_name = "user-assets-pp03uat"
size = 1024, 1024

def lambda_handler(event, context):
    # try:
      name = event['name']
      url = event['url']
      path = '/tmp/file.jpg'
      
      urllib.request.urlretrieve(url, path)
      file_name = name + ".jpg"
      
      with Image.open(path) as im:
        im.thumbnail(size) 
        im.save('/tmp/file_resized.jpg', "JPEG")
      
      s3 = boto3.resource("s3")
      s3.meta.client.upload_file(path, bucket_name, file_name, ExtraArgs={'ACL':'public-read', 'ContentType':'image/jpg'})
      
      return {
          'statusCode': 200,
          'body': 'https://' + bucket_name + '.s3.eu-west-2.amazonaws.com/' + file_name
      }
    # except:
    #   return {
    #     'statusCode': 400,
    #     'error': True
    #   }