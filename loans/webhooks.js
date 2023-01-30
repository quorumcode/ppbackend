const { UserClient, publishSMS } = require('aws-layer')
const { GBP } = require('models')
const { create } = require('./create')
const { threeDSecureOTP } = require('messages')

// NOTE: This webhook handler only handles webhooks from Lerex (card transactions and 3D secure SMS)
// Also Lerex don't send requests to dev (thanks for nothing)
exports.handleWebhooks = async (request) => {
  const { type } = request
  let response
  switch (type) {
    case (0):
    case ('TRANSACTION'):
      response = await createCardLoan(request)
      break

    case (1):
    case ('REJECT'):
      // await loanFailureNotify(request)
      response = {}
      break

    // Assume 3D secure SMS if no type 
    case ('3DSECURE'):
    default:
      response = await handle3DSecureOTP(request)
  }
  return response
}

const parseDisplayAmount = (displayAmount) => {
  const poundAmount = displayAmount.replace(/([^0-9]*)(\d*\.\d{2}|\d* )(.*)/gm, '$2')
  return Number(poundAmount)
}

const createCardLoan = async (request) => {
  const { userId: lerexID, amount, displayAmount, merchantName: otherMerchant, requestId, transactionId } = request
  const { userName } = await UserClient.fromLerexID(lerexID)
  // if parsing returns NaN use amount assume it's pounds
  let totalAmount
  if (displayAmount) { totalAmount = parseDisplayAmount(displayAmount) }
  if (!totalAmount) { totalAmount = amount }
  console.log(`[Webhook handler] Username found: ${userName}`)
  let pollenReference
  pollenReference = (transactionId || requestId)
  pollenReference = `${pollenReference}`
  const createPayload = {
    fromVirtualCard: true,
    userName,
    number: 4,
    repaymentAmount:
    GBP.toPounds(
      Math.ceil(
        GBP.toPence(totalAmount) / 4
      )
    ),
    otherMerchant,
    pollenReference,
    customItems: [{
      name: 'Virtual Card Purchase',
      imageLink: 'https://logo.clearbit.com/mastercard.com',
      price: totalAmount,
      qty: 1
    }]
  }
  console.log(`[Webhook handler] Payload for loan creation: ${JSON.stringify(createPayload)}`)
  const { loanState } = await create({ ...createPayload })
  console.log(`[Webhook handler] Loan created: ${JSON.stringify(loanState)}`)
  return { userName, responseBody: loanState }
}

const handle3DSecureOTP = async (request) => {
  const { userId: lerexID, amount, merchantName, validationValue: OTP } = request
  const { userName: phone } = await UserClient.fromLerexID(lerexID)
  await publishSMS(
    `+${phone}`,
    threeDSecureOTP(
      OTP,
      GBP.toPounds(amount),
      merchantName
    )
  )
  return { responseBody: null }
}
