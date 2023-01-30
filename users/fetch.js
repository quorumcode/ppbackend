const { UserClient } = require('aws-layer')
const { purgeKeys } = require('utils')

exports.fetch = async (request) => {
  const { userName } = request
  const user = new UserClient(userName)
  const details = await user.details()
  const settings = await user.settings()
  const primary = await user.primary()
  const recovery = await user.recovery()
  const { activeCard, waitlist } = await user.wallet()
  const { verificationID } = await user.status()
  const responseBody = {
    details,
    settings,
    primary,
    recovery,
    activeCard,
    documentsSubmitted: (!!verificationID && !!details.name),
    waitlist: !!waitlist
  }
  purgeKeys(responseBody, 'user')
  purgeKeys(responseBody, 'record')
  if (!responseBody.details.nickname) { 
    if (!!responseBody.details.name) {
    responseBody.details.nickname = (responseBody.details.name.givenName || 'Friend')
    } else {
      responseBody.details.nickname = 'Friend'
    }
  }
  return responseBody
}
