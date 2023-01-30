const { CustomerClientResponse, getOrigin } = require('utils')
const response = new CustomerClientResponse()

const { Request } = require('models')
const { fetch } = require('./fetch')
const { addNew } = require('./addNew')
const { update } = require('./update')
const { remove } = require('./remove')
const { createSetupIntent } = require('./createSetupIntent')
const { statusCheck } = require('./helpers')

exports.handler = async (event) => {
  const { path, httpMethod } = event
  const origin = getOrigin(event)
  let responseBody
  try {
    await checkStatus(event)
    switch (path) {
      case '/cards':
        switch (httpMethod) {
          case 'GET':
            responseBody = await getCards(event)
            break

          case 'POST':
            responseBody = await postCards(event)
            break

          case 'PUT':
            responseBody = await putCards(event)
            break

          case 'DELETE':
            responseBody = await deleteCards(event)
            break

          default:
            throw new Error('Invalid method.')
        }
        break

      case '/newseti':
        responseBody = await newSeti(event)
        break

      default:
        throw new Error('Invalid path.')
    }
    return response.respond(false, responseBody, 200, origin)
  } catch (err) {
    return response.handleError(err, origin)
  }
}

const checkStatus = async (event) => {
  const request = Request.userName(event)
  const { status } = await statusCheck(request)
  if (!status) { throw new Error('User unverified.') }
}

const getCards = async (event) => {
  const request = Request.getCards(event)
  const responseBody = await fetch(request)
  return responseBody
}

const postCards = async (event) => {
  const request = Request.postCards(event)
  await addNew(request)
  const responseBody = await getCards(event)
  return responseBody
}

const putCards = async (event) => {
  const request = Request.putCards(event)
  await update(request)
  const responseBody = await getCards(event)
  return responseBody
}

const deleteCards = async (event) => {
  const request = Request.deleteCards(event)
  await remove(request)
  const responseBody = await getCards(event)
  return responseBody
}

const newSeti = async (event) => {
  const request = Request.newSeti(event)
  const responseBody = await createSetupIntent(request)
  return responseBody
}
