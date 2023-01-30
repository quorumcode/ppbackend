const { UserClient } = require('aws-layer')
const { User } = require('models')
const { createCustomer } = require('stripe-layer')
// const { newLerexAccount } = require('lerex-layer')
const { PollenError } = require('utils')
const { EmailConfirmation } = require('./emailConfirmation')

// const MODE = process.env.mode

exports.update = async (request) => {
  const { userName, details, settings, recovery, customer } = request
  const data = { details, settings, recovery, customer }
  const user = new UserClient(userName)

  const { valid, errorMessage } = new User(details).validatePayload
  if (valid === false) { throw new PollenError(errorMessage) }

  // prevent clients from force writing identityId
  if (data.details?.identityId) { data.details.identityId = null }

  for (const recordType of User.listRecords) {
    if (recordType in data && data[recordType] != null) {
      // TODO await handleCustomerUpdate
      // TODO await handleEmailUpdate
      await user.updateMultipleFields(
        recordType,
        data[recordType]
      )
    }
  }

  await handleNewCustomer(user)

  // An email update requires confirmation and detach of the old email
  if (!!data.details && !!data.details.email) {
    await user.updateMultipleFields(
      'details',
      {
        emailConfirmed: false
      }
    )
    await EmailConfirmation.sendConfirmation({ userName, email: data.details.email })
  }
}

const handleNewCustomer = async (userClientInstance) => {
  let exists;

  exists = await userClientInstance.exists('primary') // check record for primary number which is not a field submitted by the client during the user creation
  if (!exists) {
    await userClientInstance.updateMultipleFields(
      'primary',
      {
        primaryNumber: userClientInstance.userName,
        primaryStatus: true
      }
    )
  }

  exists = await userClientInstance.exists('status')
  if (!exists) {
    await userClientInstance.putRecord(
      'status',
      {
        verificationID: false,
        softlocked: true
      }
    )
  }

  // legacy {
  //exists = await userClientInstance.exists('customer')
  //if (exists) {
  //  exists = await userClientInstance.customer()
  //  exists = !!exists.stripeID
  //}
  // legacy }
  exists = await userClientInstance.customer()
  exists = exists && !!exists.stripeID

  if (!exists) {
    const details = await userClientInstance.details()
    const { primaryNumber } = await userClientInstance.primary()
    const { verificationID: verified } = await userClientInstance.status()
    if (verified) {
      await userClientInstance.updateMultipleFields(
        'customer',
        {
          stripeID: 'pending'
        }
      )
      const { id: stripeID } = await createCustomer(details, primaryNumber)
      await userClientInstance.updateMultipleFields(
        'customer',
        {
          stripeID
        }
      )
    }
  }
}
