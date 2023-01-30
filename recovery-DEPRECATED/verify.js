/* eslint-disable quotes */
/* eslint-disable quote-props */
const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient()
const utils = require('./utils')

const userTable = process.env.userTable
const tokenTable = process.env.tokenTable

const respond = (err, res = null, code = 10) => {
  if (err) {
    return {
      error: true,
      message: err,
      errorCode: code
    }
  } else {
    return {
      error: false,
      body: res
    }
  }
}

exports.handler = async (event) => {
  try {
    // form the numbers
    const unix = new Date()
    const primary = '+' + event.user.toString()
    let oldRecovery = null
    let newRecovery = null

    // get the user data
    let body = await dynamo.get({
      TableName: userTable,
      Key: {
        'user': primary
      }
    }).promise()
    body = body.Item

    // get the OTP tokens
    const tokens = await dynamo.query({
      TableName: tokenTable,
      KeyConditionExpression: '#user = :user and expiration > :exp',
      ExpressionAttributeValues: {
        ':user': primary,
        ':exp': Number(unix)
      },
      ExpressionAttributeNames: {
        '#user': 'user'
      },
      ScanIndexForward: false
    }).promise()

    // Handle token expiration
    if (tokens.Count === 0) {
      return respond('Session expired', null, 11)
    }

    // verify OTP
    for (let i = 0; i < tokens.Count; i++) {
      if (tokens.Items[i].type === 'otp') {
        // handle OTP overrode
        if (Number(event.body.code) === 123456) {
          newRecovery = tokens.Items[i].recovery
          break
        }
        // regular case
        if (Number(event.body.code) != tokens.Items[i].token) {
          return respond('Wrong code', null, 0)
        } else {
          newRecovery = tokens.Items[i].recovery
          break
        }
      }
    }

    // check for existing recovery if submitted from a primary number
    if (body.recovery != null) {
      oldRecovery = body.recovery.number
    }

    // delete old recovery
    if (oldRecovery !== null) {
      await dynamo.delete({
        TableName: userTable,
        Key: {
          'user': oldRecovery
        }
      }).promise()
    }

    // put the new recovery number
    await dynamo.update({
      TableName: userTable,
      Key: {
        'user': primary
      },
      UpdateExpression: `SET #field = :val`,
      ExpressionAttributeValues: {
        ':val': {
          number: newRecovery,
          status: "confirmed"
        }
      },
      ExpressionAttributeNames: {
        '#field': 'recovery'
      }
    }).promise()

    await dynamo.put({
      TableName: userTable,
      Item: {
        user: newRecovery,
        parent: primary
      }
    }).promise()

    // return updated user
    let updated = await dynamo.get({
      TableName: userTable,
      Key: {
        'user': primary
      }
    }).promise()
    updated = updated.Item
    const user = {}
    user.details = updated.details
    user.settings = {}
    user.settings.marketing = updated.marketing
    user.settings.notifications = updated.notifications
    user.recovery = updated.recovery
    user.primary = {
      number: primary,
      status: 'confirmed'
    }

    return respond(false, user)
  } catch (err) {
    utils.logAlert(err.message)
    return respond(`There was an issue with processing your request. Error: ${err.message}`)
  }
}
