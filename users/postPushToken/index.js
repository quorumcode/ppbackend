const {
  CustomerClientResponse,
  getOrigin
} = require('utils')
const response = new CustomerClientResponse(10, 200, 'formErrorState')
const { Request } = require('models')
const { UserClient } = require('aws-layer')

const main = async (request) => {
  const { userName, deviceID, token } = request
  const userTable = new UserClient(userName)
  const { devices } = await userTable.apns()
  if (!!devices[deviceID] && devices[deviceID].length > 0) {
    devices[deviceID].push(token)
  } else {
    devices[deviceID] = [token]
  }
  devices[deviceID] = Array.from(new Set(devices[deviceID]))
  await userTable.putRecord(
    'apns',
    { devices }
  )
  return null
}

exports.handler = async (event) => {
  const origin = getOrigin(event)
  try {
    const request = Request.postPushToken(event)
    const body = await main(request)
    return response.respond(false, body, 200, origin)
  } catch (err) {
    return response.handleError(err, origin)
  }
}
