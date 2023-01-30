const { UserClient } = require('aws-layer')
const { createSI, retrieveCustomer } = require('stripe-layer')

exports.createSetupIntent = async (request) => {
  const { userName } = request

  const userTable = new UserClient(userName)
  const { stripeID } = await userTable.customer()

  const { client_secret: clientSecret } = await createSI(stripeID)
  const { name, email, phone, address } = await retrieveCustomer(stripeID)

  return {
    clientSecret,
    name,
    email,
    phone,
    address
  }
}
