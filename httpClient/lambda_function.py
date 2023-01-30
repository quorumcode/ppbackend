import json
import requests
import binascii
import base64
import html

def lambda_handler(event,context):
    url = event['url'] 
    payload = event['payload']
    headers = event['headers']
    method = event['method'] 
    response_type = event['responseType']
    payload_type = event['payloadType']
     
    print(event) 
     
    if method.lower() == 'post':
        print("Doing dedicated post")
        if payload == None:
          print("No payload")
          response = requests.post(url, headers=headers)
        elif payload_type == 'formData':        
          print("Formdata")
          response = requests.request(method, url, headers=headers, data=payload)
        else:
          print("Assuming raw json")
          response = requests.post(url, headers=headers, json=payload)
    elif method.lower() == 'get':
        print("Doing dedicated get") 
        response = requests.get(url, headers=headers)
        print(response.status_code)
    else:
        print("REQUEST TYPE", method)
        response = requests.request(method, url, headers=headers, json=payload)
    
    # if (payload_type == 'form-data'):
    #   response = requests.request(method, url, headers=headers, data=payload)                
    # else:
    #   response = requests.request(method, url, headers=headers, json=payload)              
    
    
    if (response != None):
      print(response.text)
    
    if (response_type == 'statusCode'):    
      return response.status_code
    elif (response_type == 'base64'):
      base64_encoded_data = base64.b64encode(response.content)
      base64_message = base64_encoded_data.decode('utf-8')
      return base64_message
      # return base64_encoded_data
    # elif (response_type == 'image'):
    elif (response_type == 'html'): 
      return html.unescape(str(response.content)) 
    else:
      if (url == 'https://sandbox.lerextech.com/api/rest/wallet/load'):
        return None
      elif (url == 'https://sandbox.lerextech.com/api/rest/wallet/unload'):
        return None
      return json.loads(response.text)
      # return response
      # return binascii.b2a_hex(response.content
    