/* eslint-disable quote-props */
/* eslint-disable no-eval */
const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient()
const crypto = require('crypto')
const SNS = new AWS.SNS()
const utils = require('./utils')

const userTable = process.env.userTable
const tokenTable = process.env.tokenTable
const otpExpiry = eval(process.env.otpExpiry)

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
    const unix = new Date()

    // form the numbers
    const primary = '+' + event.user.toString()
    const newRecovery = event.body.recovery

    // check if number already registered
    let body = await dynamo.get({
      TableName: userTable,
      Key: {
        'user': newRecovery
      }
    }).promise()
    body = body.Item
    if (body != null) {
      return respond('Number already registered', null, 0)
    }

    // get the user data
    body = await dynamo.get({
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

    // generate the OTP
    const expiration = Number(unix) + otpExpiry

    const otp = crypto.randomInt(100000, 1000000).toString()

    await dynamo.put({
      TableName: tokenTable,
      Item: {
        user: primary, // send SMS to the new number, put record in the DB to the primary
        expiration: expiration,
        token: otp,
        type: 'otp',
        recovery: newRecovery
      }
    }).promise()

    // send SMS
    body = await SNS.publish({
      PhoneNumber: newRecovery,
      Message: `Your code to link this phone number to PollenPay is: ${otp}. Don't share this code with anyone; members of our team will never ask for the code. This code will expire in ${otpExpiry / (60 * 1000)} minutes.`
    }).promise()

    return respond(false)
  } catch (err) {
    utils.logAlert(err.message)
    return respond(`There was an issue with processing your request. Error: ${err.message}`)
  }
}
