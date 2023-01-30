/* eslint-disable quotes */
/* eslint-disable quote-props */
const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient()
const utils = require('./utils')

const userTable = process.env.userTable

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
    const primary = '+' + event.user.toString()
    let recovery = ''

    // get the user's data
    let body = await dynamo.get({
      TableName: userTable,
      Key: {
        'user': primary
      }
    }).promise()
    body = body.Item

    // check if banned
    if (body.blocked) {
      return respond('Account banned', null, 99)
    }

    // handle no recovery error
    if (body.recovery == null) {
      return respond('No recovery number', null, 11)
    } else {
      recovery = body.recovery.number
    }

    // delete the recovery number record
    await dynamo.delete({
      TableName: userTable,
      Key: {
        'user': recovery
      }
    }).promise()

    // update the user record
    await dynamo.update({
      TableName: userTable,
      Key: {
        'user': primary
      },
      UpdateExpression: `SET #field = :val`,
      ExpressionAttributeValues: {
        ':val': null
      },
      ExpressionAttributeNames: {
        '#field': 'recovery'
      }
    }).promise()

    // form update user answer
    const updated = body
    const user = {}
    user.details = updated.details
    user.settings = {}
    user.settings.marketing = updated.marketing
    user.settings.notifications = updated.notifications
    user.recovery = null
    user.primary = {
      number: primary,
      status: 'confirmed'
    }

    return respond(false, user)
  } catch (err) {
    utils.logAlert(err.message)
    return respond(err.message)
  }
}
