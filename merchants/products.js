const { MerchantClient } = require('aws-layer')
const { invertObj } = require('ramda')

exports.getProducts = async (merchantDetailsList) => {
  for (const item of merchantDetailsList) {
    if (item.direct) {
      item.allowCustomAmounts = true
      const { merchant } = item
      let productList = null
      const merchantTable = new MerchantClient(merchant)
      const productGroups = await merchantTable.getProductGroups()
      const products = await merchantTable.getProducts()
      if (productGroups.Count > 0 && products.Count > 0) {
        productList = [...productGroups.Items]
        productList.forEach(thisProductGroup => { thisProductGroup.items = [] })
        // user product group enum so we can go through the products only once and assign them to a relevant group by matching products[n].productGroupID with the enum to get the index and use the index to determine which element of the productList is the correct productGroup
        let productGroupsEnum = {}
        for (let i = 0; i < productList.length; i++) {
          const { productGroupID } = productList[i]
          productGroupsEnum[i] = productGroupID
        }
        productGroupsEnum = invertObj(productGroupsEnum)
        products.Items.forEach(thisProduct => {
          const { productGroupID } = thisProduct
          const index = productGroupsEnum[productGroupID]
          productList[index].items.push(thisProduct)
        })
      }
      item.direct = productList
    }
  }
  return merchantDetailsList
}
