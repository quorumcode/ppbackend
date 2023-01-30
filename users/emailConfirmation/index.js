const { UserClient, mailer } = require('aws-layer')
const { Token } = require('token')
const { confirmEmail } = require('messages')

const BASE = `https://${process.env.baseURL}.execute-api.eu-west-2.amazonaws.com/dev/confirmemail`

const fs = require('fs')
const successPage = './success.html'
const errorPage = './error.html'

exports.handler = async (event) => {
  try {
    let { email, token: emailToken, user: userName } = event.queryStringParameters
    email = decodeURIComponent(email)
    emailToken = decodeURIComponent(emailToken)
    const unixMS = Date.now()

    const token = new Token(`${email}:${userName}`, unixMS)
    if (!token.validateAccess(emailToken)) { throw new Error('Invalid email token') }

    const userTable = new UserClient(userName)
    await userTable.updateMultipleFields(
      'details',
      { emailConfirmed: true }
    )
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/html'
      },
      body: fs.readFileSync(require.resolve(successPage)).toString()
    }
  } catch (err) {
    console.log(err)
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/html'
      },
      body: fs.readFileSync(require.resolve(errorPage)).toString()
    }
  }
}

class EmailConfirmation {
  static async sendConfirmation (request) {
    const { email, userName } = request

    const userTable = new UserClient(userName)
    const details = await userTable.details()
    let name = 'Friend'
    if (!!details.name) {
      name = (details.name.givenName || name)
    }

    const unixMS = Date.now()
    const token = new Token(`${email}:${userName}`, unixMS)
    const emailToken = token.accessToken
    const confirmationLink = `${BASE}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(emailToken)}&user=${encodeURIComponent(userName)}`

    const { subject, mailbody } = confirmEmail(name, email, confirmationLink)
    console.log('invoking the mailer')
    await mailer(
      [email],
      subject,
      mailbody
    )
  }

  static async resendConfirmation (request) {
    const { userName } = request
    const userTable = new UserClient(userName)
    const { email } = await userTable.details()
    await EmailConfirmation.sendConfirmation({ email, userName })
  }
}
exports.EmailConfirmation = EmailConfirmation
