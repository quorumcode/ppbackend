/* eslint-disable no-eval */
const { UserClient } = require('aws-layer')
const { PollenError } = require('utils')
const { userBlocked, emailAlreadyInUse, invalidPhoneNumber } = require('messages')
const { phone } = require('phone')

const handleBlocked = async (userName) => {
  const user = new UserClient(userName)
  const status = await user.status()
  if (!!status && status.blocked === true) {
    throw new PollenError(userBlocked)
  }
}

const handleExtraZeroInBritishNumbers = (phoneNumber) => {
  // +123456789 is Apple test account that talks to test env on the live iOS App 
  if (phoneNumber != '+123456789') {
    phoneNumber = checkPhone(phoneNumber)
  }
  return phoneNumber
}

const checkEmailAvailability = async (email) => {
  const emailConfirmed = await UserClient.emailConfirmed(email)
  if (emailConfirmed) {
    throw new PollenError(emailAlreadyInUse)
  }
  return null
}

const checkPhone = (phoneNumber) => {
  const { isValid, phoneNumber: parsedPhoneNumber, countryCode } = phone(phoneNumber)
  if (!isValid || countryCode === '+1') {
    throw new PollenError(invalidPhoneNumber)
  }
  return parsedPhoneNumber
}

module.exports = {
  handleExtraZeroInBritishNumbers,
  handleBlocked,
  checkEmailAvailability,
}
