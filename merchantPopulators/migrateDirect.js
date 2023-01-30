const {
  nanoid
} = require('nanoid')
const bcrypt = require('bcryptjs')
const {
  MerchantClient
} = require('aws-layer')
const {
  Merchant
} = require('models')

const srcServ = require('./oldBatches')

const srcMerch = require('./batch18.json')
const BATCH = 18

exports.handlerProduct = async () => {
  const data = srcServ
  let currentMerchant = null
  let currentGroup = null
  let groupIndex = -1
  let serviceIndex = -1
  let productGroupID = null
  for (const item of data) {
    if (item.merchantID !== currentMerchant) {
      currentMerchant = item.merchantID
      currentGroup = null
      groupIndex = -1
      serviceIndex = -1
      productGroupID = null
    }
    if (currentGroup == null || currentGroup !== item.serviceGroup) {
      currentGroup = item.serviceGroup
      serviceIndex = -1
      productGroupID = nanoid(8)
      groupIndex++
      const serviceGroup = {
        index: groupIndex,
        productGroupID,
        name: currentGroup
      }
      const db = new MerchantClient(currentMerchant)
      await db.putRecord(
        `productGroup-${productGroupID}`,
        serviceGroup
      )
    }
    serviceIndex++
    const productID = nanoid(8)
    const product = {
      index: serviceIndex,
      productGroupID,
      totalPrice: item.price,
      name: item.service,
      productID
    }
    const db = new MerchantClient(currentMerchant)
    await db.putRecord(
      `product-${productID}`,
      product
    )
  }
}

exports.handlerMerchantOld = async () => {
  const data = srcMerch
  const indexDict = {}
  for (const item of data) {
    const id = nanoid()
    let category = item['Service Category']
    indexDict[category] ? indexDict[category]++ : indexDict[category] = 1
    category = Number(Merchant.getCategory({
      val: category
    }))
    const details = {
      merchantName: item['Merchant Name to be on the tile'],
      relevanceIndex: indexDict[category],
      imageURL: `https://client-assets-pp03uat.s3.eu-west-2.amazonaws.com/${item['Merchant Name to be on the tile'].replace(/ /gm,'')}BG.jpg`,
      logoURL: `https://client-assets-pp03uat.s3.eu-west-2.amazonaws.com/${item['Merchant Name to be on the tile'].replace(/ /gm,'')}.png`,
      subcategory: [],
      deal: null,
      category,
      inStore: true,
      online: false,
      direct: true,
      link: item['Website'],
      parent: null,
      location: item['Address'],
      contactDetails: {
        phone: item['Telephone'],
        email: item['Email']
      }
    }
    const user = {
      hash: null,
      email: item['Email'],
      billing: {
        accountNumber: item['Account Number'],
        beneficiary: item['Company Alias(es)'] || item['Merchant Name to be on the tile'],
        sortCode: item['Sort Code'],
        commission: item['Rate'].slice(0, -1) / 100
      }
    }
    user.hash = getHash(id)
    const db = new MerchantClient(id)
    await db.putRecord(
      'details',
      details
    )
    await db.putRecord(
      'user',
      user
    )
  }
}

exports.handlerBatchRemover = async (batch) => {
  let merchantTable = new MerchantClient()
  let fullList = await merchantTable.scan()
  fullList = fullList.Items
  for (const item of fullList) {
    if (item.batch === batch) {
      merchantTable = new MerchantClient(item.merchant)
      await merchantTable.remove('details')
      await merchantTable.remove('user')
    }
  }
}

exports.handler = async () => {
  const data = srcMerch
  const batch = BATCH
  const indexDict = {}
  for (const item of data) {
    const id = nanoid()
    let category = item['Service Category']
    indexDict[category] ? indexDict[category]++ : indexDict[category] = 1
    category = Number(Merchant.getCategory({
      val: category
    }))
    const details = {
      merchantName: item['Merchant Name to be on the tile'],
      relevanceIndex: indexDict[category],
      imageURL: `https://client-assets-pp03uat.s3.eu-west-2.amazonaws.com/${item['Merchant Name to be on the tile'].replace(/ /gm,'').toLowerCase()}bg.jpg`,
      logoURL: `https://client-assets-pp03uat.s3.eu-west-2.amazonaws.com/${item['Merchant Name to be on the tile'].replace(/ /gm,'').toLowerCase()}.png`,
      subcategory: [],
      deal: null,
      category,
      inStore: true,
      online: false,
      direct: true,
      link: item['Website'],
      parent: null,
      location: item['Address'],
      contactDetails: {
        phone: item['Telephone'].toString(),
        email: item['Email']
      },
      batch
    }
    const user = {
      hash: null,
      email: item['Email'],
      billing: {
        accountNumber: item['Account Number'].toString(),
        beneficiary: item['Company Alias(es)'] || item['Merchant Name to be on the tile'],
        sortCode: item['Sort Code'].toString(),
        commission: item['Rate'].slice(0, -1) / 100
      },
      batch
    }
    user.hash = getHash(id)
    const db = new MerchantClient(id)
    await db.putRecord(
      'details',
      details
    )
    await db.putRecord(
      'user',
      user
    )
  }
}

const getHash = (pass) => {
  const hash = bcrypt.hashSync(pass, 10)
  return hash
}