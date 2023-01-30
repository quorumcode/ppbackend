const { User } = require('models')
const { checkCanAddNewCards, getCards, getPrimaryPaymentMethod, markPrimary } = require('./helpers')

exports.fetch = async (request) => {
  const { userName } = request
  let items = []

  const { items: queryItems, count } = await getCards(userName)

  if (count) {
    queryItems.forEach(item => {
      const thisItem = new User(item).paymentMethod
      items.push(thisItem)
    })
    items.sort((a, b) => (a.addedTimestampS - b.addedTimestampS))
    for (let i = 0; i < count; i++) {
      items[i].index = i
      delete items[i].addedTimestampS
    }
    const primaryID = await getPrimaryPaymentMethod(userName)
    items = markPrimary(items, primaryID)
  }

  const canAddNewCards = await checkCanAddNewCards(userName, count)

  return {
    canAddNewCards,
    count,
    items
  }
}
