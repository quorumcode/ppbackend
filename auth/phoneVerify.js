/* eslint-disable eqeqeq */
const {
  handleExtraZeroInBritishNumbers,
  handleBlocked
} = require('./helpers')
const { Token } = require('./token')
const {
  getTokens,
  postToken,
  UserClient
} = require('aws-layer')
const { PollenError, purgeKeys } = require('utils')
const { sessionExpired, wrongOTP } = require('messages')
const MODE = process.env.mode
const PWR_USER = Number(process.env.prodTestUser)

exports.phoneVerify = async (request) => {
  const { session, code } = request

  let { userName } = request
  userName = handleExtraZeroInBritishNumbers(userName)
  await handleBlocked(userName)

  const unixMS = Date.now()
  const unixS = Math.round(unixMS / 1000)
  const token = new Token(userName, unixMS)

  // validate session
  if (!(token.validateSession(session) || MODE !== 'prod')) {
    throw new PollenError(sessionExpired)
  }

  // validate OTP
  const liveTokens = await getTokens(userName, unixS)
  if (liveTokens.length === 0) {
    throw new PollenError(sessionExpired)
  }
  for (const item of liveTokens) {
    if (item.type === 'otp') {
      if (!((Number(code) === Number(item.token)) || ((MODE !== 'prod' || (Number(userName) == PWR_USER)) && Number(code) === 123456))) {
        throw new PollenError(wrongOTP)
      } else {
        break
      }
    }
  }

  // handle new user flow
  let responseBody = {
    newUserFlow: true,
    activeCard: false
  }
  const user = new UserClient(userName)
  const exists = await user.exists()
  if (exists) {
    const details = await user.details()
    const settings = await user.settings()
    const primary = await user.primary()
    const recovery = await user.recovery()
    const { activeCard } = await user.wallet()
    const { verificationID } = await user.status()
    responseBody = {
      ...responseBody,
      details,
      settings,
      primary,
      recovery,
      activeCard: (activeCard || false),
      newUserFlow: false,
      documentsSubmitted: (!!verificationID && !!details.name)
    }
    // purgeKeys(responseBody, 'user')
    // purgeKeys(responseBody, 'record')
    purgeKeys(responseBody, 'identityId')
    if (!responseBody.details.nickname) { responseBody.details.nickname = (responseBody.details.name.givenName || 'Friend') }
  }

  // generate a refresh token
  const refreshToken = token.refreshToken
  await postToken(token.refreshRecord(refreshToken))
  Object.assign(responseBody, { refreshToken })

  // generate a self encoded access token
  const accessToken = token.accessToken
  Object.assign(responseBody, { accessToken })

  return responseBody
}
