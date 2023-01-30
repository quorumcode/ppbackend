const { MerchantClient } = require('aws-layer')
const { Merchant } = require('models')
const { getSubcategories } = require('./helpers')

exports.itemsByCategory = async (request) => {
  let { category } = request
  const items = []
  const cats = Merchant.categoriesEnum
  if (!(category in cats)) {
    category = Merchant.getCategory({ val: category })
  }
  const query = await MerchantClient.getCategory(Number(category))
  items.push(...query)
  for (let i = 0; i < items.length; i++) {
    items[i].index = i
  }
  return {
    items,
    index: category,
    category: cats[Number(category)],
    subcategoryList: getSubcategories(items)
  }
}

exports.getCategoriesEnum = () => {
  return {
    categories: Merchant.categoriesEnum
  }
}
