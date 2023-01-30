const { UserClient } = require('aws-layer')
const { detachPaymentMethod } = require('stripe-layer')
const { getPrimaryPaymentMethod, getCards, setNewPrimary } = require('./helpers')
const { PollenError } = require('utils')
const { cantDetachCardWithActiveLoans } = require('messages')

exports.remove = async (request) => {
  const { userName, pmID } = request

  const { count } = await getCards(userName)
  if (count <= 1) {
    // TODO check for active loans
    if (true) {
      throw new PollenError(cantDetachCardWithActiveLoans)
    }
  }

  const userTable = new UserClient(userName)
  await userTable.deletePaymentMethodRecord(pmID)

  await detachPaymentMethod(pmID)

  const primary = await getPrimaryPaymentMethod(userName)
  if (primary === pmID || count === 1) { await setNewPrimary(userName) }
}
