/* eslint-disable eqeqeq */
const {
  handleExtraZeroInBritishNumbers,
  handleBlocked
} = require('./helpers')
const { Token } = require('./token')
const { postToken, publishSMS } = require('aws-layer')
const { OTPSMS } = require('messages')

const maintenanceSwitch = process.env.maintenanceSwitch

exports.phoneRegister = async (request) => {
  let { userName } = request
  userName = handleExtraZeroInBritishNumbers(userName)
  await handleBlocked(userName)

  const unixMS = Number(new Date())

  const token = new Token(userName, unixMS)
  const session = token.session
  await postToken(token.sessionRecord)

  const OTP = token.OTP
  await postToken(token.OTPRecord(OTP))
  if (maintenanceSwitch != 1) {
    await publishSMS(userName, OTPSMS(OTP, token.OTPExpiry))
  }

  return {
    session
  }
}
