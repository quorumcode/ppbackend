const { MerchantClient } = require('aws-layer')
const { Merchant } = require('models')

exports.scan = async () => {
  let items = []
  // group merchants with the same category in the array
  // do not return merchants with illegal categories
  const cats = Merchant.categoriesEnum
  for (const category of Object.keys(cats)) {
    const query = await MerchantClient.getCategory(Number(category))
    items.push(...query)
  }
  // do not show hidden merchants
  items = items.filter(item => !!item.hidden == false)
  return items
}
