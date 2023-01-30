// eslint-disable-next-line no-unused-vars
const { CustomerClientResponse, getOrigin, PollenError } = require('utils')
const response = new CustomerClientResponse()

const { Request } = require('models')

const { phoneRegister } = require('./phoneRegister')
const { phoneVerify } = require('./phoneVerify')
const { refresh } = require('./refresh')

// const maintenanceSwitch = process.env.maintenanceSwitch
// const PWR_USER = process.env.prodTestUser

exports.handler = async (event) => {
  const { path } = event
  const origin = getOrigin(event) 
  let responseBody
  try {
    // if (maintenanceSwitch == 1 && Number(JSON.parse(event.body).user) != PWR_USER) { throw new Error('The system is under maintenance. Try again later.') }
    switch (path) {
      case '/register':
        responseBody = await register(event)
        break

      case '/verify':
        responseBody = await verify(event)
        break

      case '/refreshtoken':
        responseBody = await refreshtoken(event)
        break

      default:
        throw new Error('Invalid path.')
    }
    console.log(responseBody)
    return response.respond(false, responseBody, 200, origin)
  } catch (err) {
    return response.handleError(err, origin)
  }
}

// Generates session token; sends OTP
const register = async (event) => {
  const request = Request.register(event)
  const responseBody = await phoneRegister(request)
  return responseBody
}

// Takes OTP and session token; generates access and refresh tokens
const verify = async (event) => {
  const request = Request.verify(event)
  const responseBody = await phoneVerify(request)
  return responseBody
}

const refreshtoken = async (event) => {
  const request = Request.refreshToken(event)
  const responseBody = await refresh(request)
  return responseBody
}
