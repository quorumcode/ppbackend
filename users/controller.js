const { CustomerClientResponse, getOrigin } = require('utils')
const response = new CustomerClientResponse()

const { Request } = require('models')
const { update } = require('./update')
const { fetch } = require('./fetch')
const { updateProfileImage } = require('./updateProfileImage')
const { checkEmailAvailability, setWaitlist } = require('./helpers')
const { EmailConfirmation } = require('./emailConfirmation')

exports.handler = async (event) => {
  console.log(event)
  const { path } = event
  const origin = getOrigin(event)
  let responseBody
  try {
    switch (path) {
      case '/getuser':
        responseBody = await getUser(event)
        break

      case '/updateuser':
        responseBody = await updateUser(event)
        break

      case '/uploadprofileimage':
        responseBody = await uploadProfileImage(event)
        break

      case '/checkemail':
        responseBody = await checkEmail(event)
        break

      case '/resendconfirmation':
        responseBody = await resendConfirmation(event)
        break

      case '/joinwaitlist':
        responseBody = await joinWaitlist(event)
        break

      default:
        throw new Error('Invalid path.')
    }
    return response.respond(false, responseBody, 200, origin)
  } catch (err) {
    return response.handleError(err, origin)
  }
}

// Fetches a user object by user ID
const getUser = async (event) => {
  const request = Request.getUser(event)
  const responseBody = await fetch(request)
  return responseBody
}

// Creates or updates a user record in the DB and Stripe and Lerex customer lists (GB only)
const updateUser = async (event) => {
  const request = Request.updateUser(event)
  await update(request)
  const responseBody = await fetch(request)
  return responseBody
}

// Accepts base-64 encoded images and updates the user profile image
const uploadProfileImage = async (event) => {
  const request = Request.uploadprofileimage(event)
  await updateProfileImage(request)
  const responseBody = await fetch(request)
  return responseBody
}

const checkEmail = async (event) => {
  const { email } = Request.checkEmail(event)
  const responseBody = await checkEmailAvailability(email)
  return responseBody
}

const resendConfirmation = async (event) => {
  const request = Request.resendConfirmation(event)
  await EmailConfirmation.resendConfirmation(request)
  return null
}

 const joinWaitlist = async (event) => {
  const request = Request.getUser(event)
  await setWaitlist(request)
  const responseBody = await fetch(request)
  return responseBody
 }
