import requests

def lambda_stuff(event:{},context:{}):

    if 'queryStringParameters' in event:
        if("s3_url" in event['queryStringParameters']) & ("target_url" in event['queryStringParameters']) & ("target_headers" in event['queryStringParameters']):

            s3_url = event['queryStringParameters']['s3_url']
            target_url = event['queryStringParameters']['target_url']
            target_headers = event['queryStringParameters']['target_headers']
        else:
            return {
                'statusCode': 500,
                'headers': {"content-type": "text/plain"},
                'body': "Error"
            }

    elif ("s3_url" in event) & ("target_url" in event) & ("target_headers" in event):

        s3_url = event['s3_url']
        target_url = event['target_url']
        target_headers = event['target_headers']

    else:
        return {
            'statusCode': 500,
            'headers': {"content-type": "text/plain"},
            'body': "Error"
        }

    s3_file_response = requests.get(s3_url)

    if s3_file_response.status_code == 200:
        s3_file = s3_file_response.content
    else:
        return {
            'statusCode': 500,
            'headers': {"content-type": "text/plain"},
            'body': "Error"
        }
    s3_file_name = s3_url.rsplit('/', 1)[1]

    file_post_response = requests.post(target_url, files={'File': s3_file},headers=target_headers)

    if file_post_response.status_code == 200:
        return {
            'statusCode': 200,
            'headers': {"content-type": "text/plain"},
            'body': "Success"
        }
    else:
        return {
            'statusCode': 500,
            'headers': {"content-type": "text/plain"},
            'body': "Error"
        }



if __name__ == "__main__":
    print(lambda_stuff({"s3_url":"https://via.placeholder.com/150/0000FF/FFFFFF/?text=Test!","target_url":"https://reqbin.com/echo/post/form","target_headers":{}},{}))