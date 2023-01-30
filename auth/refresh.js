const { Token } = require('./token')

exports.refresh = async (request) => {
  const { refresh, userName } = request

  // TODO validate refresh token

  const unixMS = Date.now()
  const token = new Token(userName, unixMS)

  // generate a self encoded access token
  const accessToken = token.accessToken
  return accessToken
}
