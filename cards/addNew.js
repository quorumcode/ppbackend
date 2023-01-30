const { UserClient } = require('aws-layer')
const { checkCanAddNewCards, getCards, setNewPrimary, blockPrepaidCards } = require('./helpers')
const { PollenError } = require('utils')
const { tooManyCards, failedToAddCard, expirationTooSoon } = require('messages')
const { retrievePM, attachPaymentMethods } = require('stripe-layer')

const REPAY_COUNT = process.env.defaultRepaymentsCount
const REPAY_PERIOD = process.env.defaultPeriod

exports.addNew = async (request) => {
  const { userName, pmID } = request

  const canAddNewCards = await checkCanAddNewCards(userName)
  if (!canAddNewCards) { throw new PollenError(tooManyCards) }

  const { digits, type, expiration, error: invalidPaymentMethod,
    funding, expire_year, expire_month,
    country_code, name, fingerprint, support3dsecure,
  } = await retrievePM(pmID)
  blockPrepaidCards(funding)
  if (invalidPaymentMethod) { throw new PollenError(failedToAddCard) }
  if (expiration < Date.now() + (REPAY_COUNT - 1) * REPAY_PERIOD) { throw new PollenError(expirationTooSoon) }

  const userTable = new UserClient(userName)
  const { stripeID } = await userTable.customer()
  await attachPaymentMethods(pmID, stripeID)
  await userTable.putRecord(
    `paymentMethod-${pmID}`,
    {
      pmID,
      type,
      digits,
      addedTimestampS: Math.round(Date.now() / 1000),
      funding, expire_year, expire_month,
      country_code, name, fingerprint, support3dsecure,
    }
  )

  const { count } = await getCards(userName)
  if (count <= 1) { await setNewPrimary(userName) }
}
