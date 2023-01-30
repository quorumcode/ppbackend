#!/usr/bin/env python3
from hyper import HTTPConnection, HTTP20Connection
from hyper.tls import init_context
import struct
import json

devEnvironments = ["dev", "development"]
prodEnvironments = ["prod", "production"]

def getOrRaise(dict, key, default=None):
    result = dict.get(key, default)
    if result == None:
        raise ValueError("Missing {} key in request".format(key))
    return result

def getEnvironment(dict):
    result = getOrRaise(dict, "environment")
    if result in devEnvironments + prodEnvironments:
        return result
    raise ValueError("Invalid Environment found. Please set either 'dev' or 'prod' as the value for 'environment' key in request.")

def send_push(input):
    topic = getOrRaise(input, "topic")    
    token = getOrRaise(input, "token_hex")
    apnsPayload = getOrRaise(input, "apns")
    environment = getEnvironment(input)

    if environment in devEnvironments:
        host = "api.development.push.apple.com"
        # pushCert = "cert/pushcert_dev.p12" 
    else:
        host = "api.push.apple.com"
        # pushCert = "cert/pushcert_prod.p12" 

    print(host)

    method = "POST"
    path = "/3/device/{}".format(token)

    # Build headers
    headers = {"apns-topic": topic}
    
    if input.get("apns-push-type"):
        headers["apns-push-type"] = input.get("apns-push-type")
    if input.get("apns-id"):
        headers["apns-id"] = input.get("apns-id")
    if input.get("apns-expiration"):
        headers["apns-expiration"] = input.get("apns-expiration")
    if input.get("apns-priority"):
        headers["apns-priority"] = input.get("apns-priority")
    if input.get("apns-collapse-id"):
        headers["apns-collapse-id"] = input.get("apns-collapse-id")
    
    # TODO actualise for production
    conn = HTTP20Connection(
        host=host,
        secure=True,
        port=443,
        ssl_context=init_context(cert=("./cert.pem","./key.pem")) 
    )

    conn.request(
        method=method,
        url=path,
        body=json.dumps(apnsPayload).encode("utf-8"),
        headers=headers
    )

    return conn.get_response().read()


def lambda_handler(event, context):
    try:
        input = {
            "topic": "com.pollenpayuk.pollenpay",
            "environment": "dev",
            # "apns": {
            #     "aps": { 
            #         "alert": "AWS Alert!"
            #     }
            # },
            # "apns": {   
            #   "aps": {
            #     "content-available": 1,
            #     "sound" : ""
            #   },
            #   "type": "walletUpdate",      
            #   "wallet": {
            #     "limit": 250,
            #     "unlocked": False
            #   }
            # },
            # "token_hex": "d89cdb117f725e7e613fc9f2bba3787f604712a97de673f554ee8b0f39cca8e5"
        }
        
        input["token_hex"] = event["deviceToken"]
        input["environment"] = event["environment"]
        input["apns"] = event["payload"]
        
        response = send_push(input)
        print(str(response))
        return {
            "statusCode": 200,
            "body": json.dumps({
                "error": False,
                "body": str(response)
            })
        }

    except Exception as e:
        print(str(e))
        return {
            "statusCode": 200,
            "body": json.dumps({
                "error": True,
                "body": str(e)
            })
        }