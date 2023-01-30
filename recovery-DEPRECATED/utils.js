/* eslint-disable quote-props */
/* eslint-disable no-eval */
/* eslint-disable quotes */
const crypto = require('crypto')

const AWS = require('aws-sdk')

const dynamo = new AWS.DynamoDB.DocumentClient()
const bigBrain = new AWS.DynamoDB()

const userTable = process.env.userTable
const eventsTable = process.env.eventsTable
const loanTable = process.env.loanTable
const eventReferenceTable = process.env.eventReferenceTable
const directMerchantTable = process.env.directMerchantTable
const emailReferenceTable = process.env.emailReferenceTable
const AWSRegion = process.env.AWSRegion
const lerexSecretName = process.env.lerexSecretName

const upcomingPaymentNotification2 = eval(process.env.upcomingPaymentNotification2)
const upcomingPaymentNotification1 = eval(process.env.upcomingPaymentNotification1)

// returns how many days elapsed since unix day 0
const unixDays = (timestampMS) => {
  // return Math.floor(new Date(timestampMS) / (24 * 60 * 60 * 1000)) // returns full days
  return Math.floor(new Date(timestampMS) / (12 * 60 * 60 * 1000))
}
exports.unixDays = unixDays

const periodsToTimestamp = (days, period = 12, unit = 1) => {
  return days * period * 60 * 60 * unit
}
exports.periodsToTimestamp = periodsToTimestamp

// puts an event item to the event table and the inverted item to the event reference table
const scheduler = async (txID, timestampS, type) => {
  try {
    const day = unixDays(timestampS * 1000)
    await dynamo.put({
      TableName: eventsTable,
      Item: {
        txID: txID,
        date: day,
        type: type,
        ttl: timestampS + 7 * 24 * 60 * 60
      }
    }).promise()
    await dynamo.update({
      TableName: eventReferenceTable,
      Key: {
        date: day
      },
      UpdateExpression: `SET #L = list_append(#L,:i)`,
      ExpressionAttributeValues: {
        ':i': [txID]
      },
      ExpressionAttributeNames: {
        '#L': 'transactions'
      }
    }).promise()
    return true
  } catch (err) {
    return false
  }
}
exports.scheduler = scheduler

// const schedulePushPayCheckV1 = async (txID, timestampS, checkPeriod) => {
//   try {
//     const pushTime = Number(timestampS) - Math.ceil(upcomingPaymentNotification2 / 1000)
//     if (pushTime > Number(new Date()) / 1000) {
//       await scheduler(txID, pushTime, 'push')
//     }

//     await scheduler(txID, Number(timestampS), 'pay')

//     const day = 24 * 60 * 60
//     for (let i = 1; i <= checkPeriod; i++) {
//       await scheduler(txID, Number(timestampS) + i * day, 'check')
//     }

//     return true
//   } catch (err) {
//     return false
//   }
// }

const schedulePushPayCheck = async (txID, timestampS, checkPeriod = 3) => {
  try {
    const rem1 = Number(timestampS) - Math.ceil(upcomingPaymentNotification1 / 1000)
    if (rem1 > Number(new Date()) / 1000) {
      await scheduler(txID, rem1, 'rem1')
    }

    const rem2 = Number(timestampS) - Math.ceil(upcomingPaymentNotification2 / 1000)
    if (rem2 > Number(new Date()) / 1000) {
      await scheduler(txID, rem2, 'rem2')
    }

    await scheduler(txID, Number(timestampS), 'pay')

    const day = 24 * 60 * 60
    await scheduler(txID, Number(timestampS) + checkPeriod * day, 'check')
    // for (let i = 1; i <= checkPeriod; i++) {
    //   await scheduler(txID, Number(timestampS) + i * day, 'check')
    // }

    return true
  } catch (err) {
    return false
  }
}
exports.schedulePushPayCheck = schedulePushPayCheck

const scheduleDisabled = async (txID) => {
  const events = await dynamo.query({
    TableName: eventsTable,
    KeyConditionExpression: 'txID = :id',
    ExpressionAttributeValues: {
      ':id': txID
    }
  }).promise()

  for (const event of events.Items) {
    await dynamo.put({
      TableName: eventsTable,
      Item: {
        txID: txID,
        date: event.date,
        type: 'disabled',
        ttl: event.ttl
      }
    }).promise()
  }

  return true
}
exports.scheduleDisabled = scheduleDisabled

const scheduleWaitPayCheck = async (txID, timestampS, eventType, checkPeriod = 3, delayPeriod = 3, waitPeriod = 1) => {
  const day = 24 * 60 * 60
  const wait = waitPeriod * day
  await scheduler(txID, Number(timestampS) + wait, eventType)
  const delay = delayPeriod * day
  await scheduler(txID, Number(timestampS) + delay, 'pay')
  const check = checkPeriod * day
  await scheduler(txID, Number(timestampS) + check, 'check')
  return true
}
exports.scheduleWaitPayCheck = scheduleWaitPayCheck

/* Old functions for the eventbridge flow

const dateToCron = (time, frequency) => {
  let response = new Date(Number(time) * 1000)
  switch (frequency) {
    case 'once':
      response = `cron(${response.getMinutes()} ${response.getHours()} ${response.getDate()} ${(response.getMonth() + 1)} ? ${response.getFullYear()})`
      break
    case 'daily':
      response = `cron(${response.getMinutes()} ${response.getHours()} * * ? ${response.getFullYear()})`
      break
    default:
      break
  }
  return response
}

const putRule = async (txID, timestamp, functionArn) => {
  const when = dateToCron(
    (timestamp - 5 * 60), // start in 23 hrs 55 mins from tomorrow repeat daily
    'daily'
  ).toString()

  const rule = await eventBridge.putRule({
    Name: txID,
    ScheduleExpression: when,
    State: 'ENABLED'
  }).promise()

  const target = await eventBridge.putTargets({
    Rule: txID,
    Targets: [{
      Arn: functionArn,
      Id: txID,
      Input: JSON.stringify({
        txID: txID
      })
    }]
  }).promise()

  const permission = await lambda.addPermission({
    FunctionName: functionArn,
    StatementId: txID,
    Action: 'lambda:InvokeFunction',
    Principal: 'events.amazonaws.com',
    SourceArn: rule.RuleArn
  }).promise()

  return true
}

*/

const formTxID = (userName, loanID, transactionID) => {
  if (userName.includes('+')) {
    userName = userName.slice(1)
  }
  return `${userName.toString()}-${loanID.toString()}-${transactionID.toString()}`
}
exports.formTxID = formTxID

const logAlert = async (message, type) => {
  console.log(`ERROR ${message}`)
}
exports.logAlert = logAlert

const loanUpdate = async (newLoan, newTransaction, newTransactionIndex, cursorIndex, userName, unix) => {
  newLoan.transactions[newTransactionIndex] = newTransaction

  // add the new loan
  await dynamo.update({
    TableName: loanTable,
    Key: {
      'user': userName
    },
    UpdateExpression: `SET #L = list_append(#L,:l)`,
    ExpressionAttributeValues: {
      ':l': [newLoan]
    },
    ExpressionAttributeNames: {
      '#L': 'loans'
    }
  }).promise()

  // archive the old loan
  await bigBrain.updateItem({
    TableName: loanTable,
    Key: {
      'user': {
        S: userName
      }
    },
    UpdateExpression: `SET #loans[${cursorIndex}].#archived = :a`,
    ExpressionAttributeValues: {
      ':a': {
        M: {
          archivedStatus: {
            BOOL: true
          },
          archivedDate: {
            S: unix.toString()
          }
        }
      }
    },
    ExpressionAttributeNames: {
      '#loans': 'loans',
      '#archived': 'archived'
    },
    ReturnValues: "UPDATED_NEW"
  }).promise()

  return 0
}
exports.loanUpdate = loanUpdate

const handleSecondary = async (number) => {
  let userName = number
  let body = await dynamo.get({
    TableName: userTable,
    Key: {
      'user': userName
    }
  }).promise()
  body = body.Item
  if (body != null) {
    if (body.parent != null) {
      userName = body.parent
    }
  }
  return userName
}
exports.handleSecondary = handleSecondary

const stringToBase64 = (utf8) => {
  return Buffer
    .from(utf8)
    .toString('base64')
}
exports.stringToBase64 = stringToBase64

const base64ToUTF8 = (base64) => {
  return Buffer
    .from(base64, 'base64')
    .toString('utf8')
}
exports.base64ToUTF8 = base64ToUTF8

const decodeBasicAuth = (token) => {
  let creds = base64ToUTF8(token.slice(5))
  creds = creds.split(':')
  return {
    user: creds[0],
    password: creds[1]
  }
}
exports.decodeBasicAuth = decodeBasicAuth

function stringToBase10 (string) {
  let number = ""
  const length = string.length
  for (let i = 0; i < length; i++) {
    number += string.charCodeAt(i).toString(10)
  }
  return number
}
exports.stringToBase10 = stringToBase10

const https = require('https')
const basicAuthRequest = async (method, host, path, auth, payload) => {
  const options = {
    'method': method,
    'hostname': host,
    'path': path,
    'headers': {
      'Authorization': `Basic ${auth}`
    },
    'maxRedirects': 20
  }
  let out
  const req = https.request(options, function (res) {
    const chunks = []

    res.on("data", function (chunk) {
      chunks.push(chunk)
    })

    res.on("end", function (chunk) {
      out = Buffer.concat(chunks)
    })

    res.on("error", function (error) {
      logAlert(error)
    })
  })

  if (method === 'PUT') {
    const postData = JSON.stringify(payload)
    req.write(postData)
  }

  req.end()
  return out
}

class ZendeskClient {
  constructor (domain, customerEmail, adminUser, adminPass) {
    this.domain = domain
    this.customerEmail = customerEmail
    this.adminUser = adminUser
    this.adminPass = adminPass
  }

  async searchUsers () {
    const users = await basicAuthRequest(
      'GET',
      this.domain,
      `/api/v2/users/search.json?query=${this.customerEmail}`,
      stringToBase64(`${this.adminUser}:${this.adminPass}`)
    )
    return users.users
  }

  async getID () {
    const users = await this.searchUsers()
    return users[0].id
  }

  async setARemoteImageURL (profileURL) {
    const userID = await this.getID()
    await basicAuthRequest(
      'PUT',
      this.domain,
      `/api/v2/users/${userID}.json`,
      stringToBase64(`${this.adminUser}:${this.adminPass}`), {
        'user': {
          'remote_photo_url': profileURL
        }
      }
    )
  }
}
exports.ZendeskClient = ZendeskClient

class CustomerClientResponse {
  constructor (defaultErrorCode = 84) {
    this.defaultErrorCode = defaultErrorCode
  }

  respond (err, res = null, code = this.defaultErrorCode) {
    if (err) {
      return {
        error: true,
        message: err,
        errorCode: code != null ? code : this.defaultErrorCode
      }
    } else {
      return {
        error: false,
        body: res
      }
    }
  }
}
exports.CustomerClientResponse = CustomerClientResponse

const loanStatusCodes = {
  showAsBalance: 0,
  showAsPurchase: 1,
  markDeleted: 2
}
exports.loanStatusCodes = loanStatusCodes

const formDirectID = (email, merchantName) => {
  // const unix = new Date()
  // return `${stringToBase10(email)}-${stringToBase64(merchantName)}-${stringToBase64(unix)}`
  return Number(new Date())
}
exports.formDirectID = formDirectID

class AdminClientResponse {
  constructor (defaultStatusCode = 200, defaultErrorDisplay = 'errorPage') {
    this.defaultErrorCode = defaultErrorDisplay
    this.defaultStatusCode = defaultStatusCode
  }

  respond (err, res = null, statusCode = this.defaultStatusCode, errorDisplay = this.defaultErrorDisplay) {
    if (err) {
      return {
        statusCode: statusCode,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: true,
          message: err,
          errorDisplay: errorDisplay
        })
      }
    } else {
      return {
        statusCode: statusCode,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: false,
          body: res
        })
      }
    }
  }
}
exports.AdminClientResponse = AdminClientResponse

const getDirectID = async (email) => {
  let directID = false
  directID = await dynamo.get({
    TableName: directMerchantTable,
    Key: {
      'email': email
    }
  }).promise()
  directID = directID.Item
  if (directID != null) {
    directID = directID.ID
  }
  return directID
}
exports.getDirectID = getDirectID

const nLongRandomString = (n) => {
  return crypto.randomBytes(n).toString('hex')
}
exports.nLongRandomString = nLongRandomString

const getPrincipalFromProxyEvent = (event) => {
  return JSON.parse(event.requestContext.authorizer.principalId)
}
exports.getPrincipalFromProxyEvent = getPrincipalFromProxyEvent

const getQueryParamsFromProxyEvent = (event) => {
  return event.queryStringParameters
}
exports.getQueryParamsFromProxyEvent = getQueryParamsFromProxyEvent

const getEmailStatus = async (email) => {
  const userEmail = email
  let confirmedEmail = await dynamo.get({
    TableName: emailReferenceTable,
    Key: {
      'email': userEmail
    }
  }).promise()
  confirmedEmail = confirmedEmail.Item

  if (confirmedEmail == null || confirmedEmail.confirmed === false) {
    return false
  } else {
    return true
  }
}
exports.getEmailStatus = getEmailStatus

const forgetEmail = async (email) => {
  await dynamo.put({
    TableName: emailReferenceTable,
    Item: {
      email: email,
      confirmed: false
    }
  }).promise()
}
exports.forgetEmail = forgetEmail

const softLockTable = process.env.softLockTable
const softLockSwitch = async (phone, verificationIDMinusTwo, status) => {
  await dynamo.put({
    TableName: softLockTable,
    Item: {
      user: phone,
      verificationID: verificationIDMinusTwo,
      softLocked: status
    }
  }).promise()
}
exports.softLockSwitch = softLockSwitch

const softLockCheck = async (user) => {
  let status = await dynamo.get({
    TableName: softLockTable,
    Key: {
      'user': user
    }
  }).promise()
  status = status.Item
  if (status != null) {
    status = status.softLocked
  } else {
    status = false
  }
  return status
}
exports.softLockCheck = softLockCheck

const httpClientFunction = process.env.httpClientFunction
const lambda = new AWS.Lambda()
class HttpClient {
  constructor () {
    this.httpClientFunction = httpClientFunction
  }

  async request (method, url, payload, headers, responseType = 'body') {
    const body = await lambda.invoke({
      FunctionName: this.httpClientFunction,
      Payload: JSON.stringify({
        method: method,
        url: url,
        headers: headers,
        payload: payload,
        responseType: responseType // 'body' to return body, 'statusCode' to return statusCode
      }),
      InvocationType: 'RequestResponse'
    }).promise()
    return JSON.parse(body.Payload)
  }

  async invoke (method, url, payload, headers) {
    const body = await lambda.invoke({
      FunctionName: this.httpClientFunction,
      Payload: JSON.stringify({
        method: method,
        url: url,
        headers: headers,
        payload: payload,
        responseType: ''
      }),
      InvocationType: 'Event'
    }).promise()
    return body
  }
}
exports.HttpClient = HttpClient

// const lerexAuthHeaders = (key, secret) => {
//   const nonce = Number(new Date())
//   const timestamp = nonce
//   const signatureString = `LRX-ENC.V.1.0:${nonce}:${timestamp}:${key}`
//   const encodedSignature = crypto
//     .createHmac('sha1', secret)
//     .update(signatureString)
//     .digest('hex')
//   return {
//     'x-msg-timestamp': timestamp.toString(),
//     'x-msg-nonce': nonce.toString(),
//     Authorization: `Signature apiKey=${key}, signature=${encodedSignature}`
//   }
// }

class LerexClientTest {
  constructor (user, password) {
    this.auth = {
      Authorization: 'Basic ' + stringToBase64(`${user}:${password}`)
    }
    this.domain = 'http://sandbox.lerextech.com/api/rest'
  }

  async getOrganisationDetails () {
    const http = new HttpClient()
    const out = await http.request(
      'GET',
      this.domain + '/organisation/details',
      {},
      this.headers
    )
    return out
  }
}
exports.LerexClientTest = LerexClientTest

const secretManager = new AWS.SecretsManager({
  region: AWSRegion
})
const retrieveSecrets = async (secretName) => {
  const secret = await secretManager.getSecretValue({ SecretId: secretName }).promise()
  return {
    key: JSON.parse(secret.SecretString).apiKey,
    secret: JSON.parse(secret.SecretString).Secret
  }
}
exports.retrieveSecrets = retrieveSecrets

class LerexClient {
  constructor (key, secret) {
    this.headers = {
      ...this.authHeaders(key, secret)
    }
    this.domain = 'http://sandbox.lerextech.com/api/rest'
  }

  static async builder () {
    const { key, secret } = await retrieveSecrets(lerexSecretName)
    return new LerexClient(key, secret)
  }

  authHeaders (key, secret) {
    const nonce = Number(new Date())
    const timestamp = nonce
    const signatureString = `LRX-ENC.V.1.0:${nonce}:${timestamp}:${key}`
    const encodedSignature = crypto
      .createHmac('sha1', secret)
      .update(signatureString)
      .digest('hex')
    return {
      'x-msg-timestamp': timestamp.toString(),
      'x-msg-nonce': nonce.toString(),
      Authorization: `Signature apiKey=${key}, signature=${encodedSignature}`
    }
  }

  async getOrganisationDetails () {
    const http = new HttpClient()
    const out = await http.request(
      'GET',
      this.domain + '/organisation/details',
      {},
      this.headers
    )
    return out
  }

  async postNewActiveUser (firstName, lastName, email, sourceOfFunds = 4, countryId = 2, emailConfirmed = true) {
    const payload = {
      firstName: firstName,
      lastName: lastName,
      email: email,
      sourceOfFunds: sourceOfFunds,
      countryId: countryId,
      emailConfirmed: emailConfirmed
    }
    const res = new HttpClient().request(
      'POST',
      this.domain + '/users',
      payload,
      this.headers
    )
    return res.id
  }

  async updateKYCStatus (lerexID, status) {
    let KYCStatus = 0
    if (status) {
      KYCStatus = 1
    }
    const res = new HttpClient().request(
      'GET',
      `${this.domain}/users/update-kyc-status?userId=${lerexID}&KYCStatus=${KYCStatus}`, {},
      this.headers,
      'statusCode'
    )
    if (res === 200) {
      return true
    } else {
      return false
    }
  }

  async getOrgAccount (accountID) {
    const res = new HttpClient().request(
      'GET',
      `${this.domain}/organisation/account-balance/${accountID}`, {},
      this.headers
    )
    return res
  }

  async payout (fromBankAccountID, poundAmount, beneficiaryName, accountNumber, sortCode, reference, currencyID = 1) {
    const payload = {
      fromBankAccountID: fromBankAccountID,
      amount: poundAmount,
      beneficiaryName: beneficiaryName,
      accountNumber: accountNumber,
      sortCode: sortCode,
      reference: reference,
      currencyId: currencyID
    }
    const res = new HttpClient().request(
      'POST',
      this.domain + '/organisation/make-payment',
      payload,
      this.headers,
      'statusCode'
    )
    if (res === 200) {
      return true
    } else {
      return false
    }
  }
}
exports.LerexClient = LerexClient

// const changeMyKey = (length) => {

// }

const daysDiff = (date2, date1) => {
  return Math.ceil((date2 - date1) / (1000 * 60 * 60 * 24))
}

const daysToWeeks = (days) => {
  return Math.floor(days / 7)
}

const daysToMonths = (days) => {
  return Math.floor(days / 30)
}

const timestampToHuman = (timestampSeconds) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  return `${days[new Date(timestampSeconds * 1000).getDay()]} ${new Date(timestampSeconds * 1000).getDate()} ${months[new Date(timestampSeconds * 1000).getMonth()]} ${new Date(timestampSeconds * 1000).getFullYear()}`
}
exports.timestampToHuman = timestampToHuman

const daysLeft = (timestampSeconds, next = false) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  let res = `${new Date(timestampSeconds * 1000).getDate()} ${months[new Date(timestampSeconds * 1000).getMonth()]}`
  if (next) {
    const days = daysDiff(timestampSeconds * 1000, Number(new Date()))
    if (days >= 60) {
      res += ` (in ${daysToMonths(days)} months)`
    } else if (days >= 30) {
      res += ` (in a month)`
    } else if (days >= 14) {
      res += ` (in ${daysToWeeks(days)} weeks)`
    } else if (days > 7) {
      res += ` (in a week)`
    } else if (days > 1) {
      res += ` (in ${days} days)`
    } else if (days === 1) {
      res += ' (tomorrow)'
    } else if (days === 0) {
      res += ' (today)'
    } else {
      res += ` (${-1 * days} days late)`
    }
  }
  return res
}
exports.daysLeft = daysLeft

const getIndexOfNextPayment = (transactions) => {
  for (let i = 0; i < transactions.length; i++) {
    if (transactions[i].status !== 'paid') {
      return i
    }
  }
}
exports.getIndexOfNextPayment = getIndexOfNextPayment

const fullName = (nameObject) => {
  let name = nameObject.givenName
  if ('surname' in nameObject) {
    name += ` ${nameObject.surname}`
  }
  return name
}
exports.fullName = fullName

class PollenError extends Error {
  constructor (messageObject) {
    const { message, errorCode } = messageObject
    super(message)
    this.errorCode = errorCode
  }
}
exports.PollenError = PollenError
