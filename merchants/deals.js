const { MerchantClient } = require('aws-layer')

exports.getDeals = async (merchantDetailsList) => {
  for (const item of merchantDetailsList) {
    if (item.deal) {
      const { merchant } = item
      const db = new MerchantClient(merchant)
      let campaign = await db.query('campaign')
      if (campaign.Count > 0) { campaign = campaign.Items[0] } else { campaign = { act: false } }
      item.deal = campaign
    }
  }
  return merchantDetailsList
}
