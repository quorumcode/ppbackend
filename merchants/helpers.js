const { Merchant, GBP } = require('models')
const { purgeKeys } = require('utils')

exports.formatMerchantList = (merchants) => {
  const items = []
  for (const entry of merchants) {
    let item = new Merchant(entry).details
    item = purgeKeys(item, 'location')
    item = purgeKeys(item, 'parent')
    item.category = Merchant.categoriesEnum[item.category]
    items.push(item)
  }
  return {
    items
  }
}

exports.formatInstoreMerchantList = (merchants) => {
  const items = []
  for (const entry of merchants) {
    let item = new Merchant(entry).details
    item = purgeKeys(item, 'location')
    item = purgeKeys(item, 'parent')
    item.category = Merchant.categoriesEnum[item.category]
    const { lat, lng, address } = entry
    Object.assign(item, { lat, lng, address })
    items.push(item)
  }
  return {
    items
  }
}

exports.legacyFormatMerchantList = (merchants) => {
  const items = []
  for (const entry of merchants) {
    let item = new Merchant(entry).details
    item = purgeKeys(item, 'location')
    item = purgeKeys(item, 'parent')
    item = purgeKeys(item, 'subcategory')
    item = purgeKeys(item, 'inStore')
    item = purgeKeys(item, 'online')
    item = purgeKeys(item, 'popular')
    item = purgeKeys(item, 'created')
    if (!item.link) {
      item.link = 'pollenpay.com'
    }
    item.category = Merchant.categoriesEnum[item.category]
    if (item.direct) {
      item.Directs = item.direct
      item.allowCustomAmounts = true
    }
    if ('direct' in item) {
      delete item.direct
    }
    items.push(item)
  }
  return {
    items
  }
}

exports.formatProductList = (merchants) => {
  for (const item of merchants) {
    if (item.direct) {
      for (let group of item.direct) {
        group = purgeKeys(group, 'merchant')
        group = purgeKeys(group, 'record')
        group = purgeKeys(group, 'productGroupID')
      }
    }
  }
  return merchants
}

exports.legacyFormatProductList = (merchants) => {
  for (const merchantItem of merchants) {
    if (merchantItem.direct) {
      const Directs = []
      for (const serviceGroup of merchantItem.direct) {
        const services = []
        for (const serviceItem of serviceGroup.items) {
          services.push({
            index: serviceItem.index,
            serviceName: serviceItem.name,
            serviceID: serviceItem.productID,
            price: serviceItem.totalPrice
          })
        }
        Directs.push({
          services,
          index: serviceGroup.index,
          serviceGroup: serviceGroup.name
        })
      }
      merchantItem.direct = Directs
      merchantItem.allowCustomAmounts = true
    }
  }
  return merchants
}

exports.normalisePath = (path) => {
  return (/categories\/.*/g.test(path)) ? '/categories/:categoryID' : path
}

exports.groupByCategories = (merchantList, subcategoryListIncl = true) => {
  const items = []
  merchantList = merchantList.items
  for (const category of Object.values(Merchant.categoriesEnum)) {
    const item = {
      category,
      index: Number(Merchant.getCategory({ val: category })),
      items: merchantList.filter(merchant => merchant.category === category)
    }
    for (let i = 0; i < item.items.length; i++) {
      item.items[i].index = i
    }
    if (subcategoryListIncl) { item.subcategoryList = getSubcategories(item.items) }
    items.push(item)
    merchantList = merchantList.filter(merchant => merchant.category !== category)
  }
  return {
    Items: items
  }
}

const getSubcategories = (merchantList) => {
  let items = []
  for (const merchant of merchantList) {
    if (merchant.subcategory && merchant.subcategory.length) {
      items.push(...merchant.subcategory)
    }
  }
  items = Array.from(
    new Set(
      items
    )
  )
  return items
}

exports.getSubcategories = getSubcategories
