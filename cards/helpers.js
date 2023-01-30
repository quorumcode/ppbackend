const { UserClient } = require('aws-layer')
const { PollenError } = require('utils')
const { badCard } = require('messages')
// const { User } = require('models')

const PM_CAP = process.env.paymentMethodMaxCount

exports.checkCanAddNewCards = async (userName = null, count = null) => {
  if (!count && !!userName) {
    const userTable = new UserClient(userName)
    const paymentMethod = await userTable.paymentMethod()
    count = paymentMethod.count
  }

  if (!userName && !count) { return false }

  return PM_CAP > count
}

const getCards = async (userName) => {
  const userTable = new UserClient(userName)
  const { items, count } = await userTable.paymentMethod()
  return {
    items,
    count
  }
}
exports.getCards = getCards

exports.getPrimaryPaymentMethod = async (userName) => {
  const userTable = new UserClient(userName)
  const { primaryPaymentMethod } = await userTable.customer()
  if (!primaryPaymentMethod) { return null }
  return primaryPaymentMethod
}

exports.markPrimary = (items, primaryPaymentMethod) => {
  for (const item of items) {
    if (item.pmID === primaryPaymentMethod) {
      item.primary = true
      break
    }
  }
  return items
}

const setPrimary = async (userName, pmID) => {
  const userTable = new UserClient(userName)
  await userTable.updateField(
    'customer',
    'primaryPaymentMethod',
    pmID
  )
}
exports.setPrimary = setPrimary

exports.setNewPrimary = async (userName) => {
  const { items } = await getCards(userName)
  items.sort((a, b) => (b.addedTimestampS - a.addedTimestampS))
  await setPrimary(
    userName,
    items[0].pmID
  )
}

exports.statusCheck = async (request) => {
  const { userName } = request
  const userTable = new UserClient(userName)
  const { verificationID } = await userTable.status()
  return {
    status: !!verificationID
  }
}

exports.blockPrepaidCards = (funding) => {
  if (funding === 'prepaid' || funding === 'unknown') {
    throw new PollenError(badCard)
  }
}
