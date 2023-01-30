/* eslint-disable no-eval */
const { UserClient } = require('aws-layer')
const { PollenError } = require('utils')
const { emailAlreadyInUse } = require('messages')

exports.checkEmailAvailability = async (email) => {
  const emailConfirmed = await UserClient.emailConfirmed(email)
  if (emailConfirmed) {
    throw new PollenError(emailAlreadyInUse)
  }
  return null
}

exports.setWaitlist = async ({ userName }) => {
  const userTable = new UserClient(userName)
  await userTable.updateMultipleFields(
    'wallet',
    {
      waitlist: true
    }
  )
}
