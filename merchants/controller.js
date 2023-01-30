const { CustomerClientResponse, getOrigin } = require('utils')
const response = new CustomerClientResponse()

const { Request } = require('models')
const { itemsByCategory, getCategoriesEnum } = require('./categories')
const { scan } = require('./scan')
const { getDeals } = require('./deals')
const { getProducts } = require('./products')
const { getLocations } = require('./locations')
const {
  formatMerchantList,
  normalisePath,
  groupByCategories,
  formatProductList,
  legacyFormatMerchantList,
  formatInstoreMerchantList,
  legacyFormatProductList
} = require('./helpers')

exports.handler = async (event) => {
  const { path } = event
  const origin = getOrigin(event)
  let responseBody
  try {
    switch (normalisePath(path)) {
      case '/getmerchants':
        responseBody = await legacyMerchantCategories()
        break

      case '/categories':
        responseBody = await merchantCategories()
        break

      case '/categories/:categoryID':
        responseBody = await categoryID(event)
        break

      case '/merchants':
        responseBody = await merchants()
        break

      case '/listcategories':
        responseBody = await listCategories()
        break

      default:
        throw new Error('Invalid path.')
    }
    return response.respond(false, responseBody, 200, origin)
  } catch (err) {
    return response.handleError(err, origin)
  }
}

const merchantCategories = async () => {
  let responseBody = await merchants()
  responseBody = groupByCategories(responseBody)
  return responseBody
}

// for iOS client
const legacyMerchantCategories = async () => {
  console.log('Scanning')
  let responseBody = await scan()
  console.log('Getting deals')
  responseBody = await getDeals(responseBody)
  console.log('Getting products')
  responseBody = await getProducts(responseBody)
  console.log('Formatting product list')
  responseBody = legacyFormatProductList(responseBody)
  console.log('Formatting merchant list')
  responseBody = legacyFormatMerchantList(responseBody)
  console.log('Grouping by cats')
  responseBody = groupByCategories(responseBody, false)
  return responseBody
}

const merchants = async () => {
  let responseBody = await scan()
  responseBody = await getDeals(responseBody)
  responseBody = await getProducts(responseBody)
  responseBody = formatProductList(responseBody)
  responseBody = formatMerchantList(responseBody)
  return responseBody
}

const categoryID = async (event) => {
  const request = Request.categoryID(event)
  const responseBody = await itemsByCategory(request)
  responseBody.items = await getLocations(responseBody.items)
  responseBody.items = await getProducts(responseBody.items)
  const { items: formattedItems } = formatInstoreMerchantList(responseBody.items)
  responseBody.items = formattedItems
  return responseBody
}

const listCategories = () => {
  const responseBody = getCategoriesEnum()
  return responseBody
}
