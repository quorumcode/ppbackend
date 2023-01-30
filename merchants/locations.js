const { MerchantClient } = require('aws-layer')

exports.getLocations = async (merchantDetailsList) => {
  for (const item of merchantDetailsList) {
    if (item.inStore) {
      const { merchant } = item
      const merchantTable = new MerchantClient(merchant)
      const { Count, Items } = await merchantTable.query('location')
      if (Count > 0) {
        const { lng, lat, address } = Items[0]
        Object.assign(item, { lng, lat, address })
      } else {
        item.inStore = false
      }
    }
  }
  merchantDetailsList = merchantDetailsList.filter(merchant => merchant.inStore)
  return merchantDetailsList
}
