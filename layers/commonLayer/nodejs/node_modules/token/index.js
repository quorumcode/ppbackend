/* eslint-disable no-eval */
const crypto = require('crypto')

const STAGE_IV = process.env.stageIV
const STAGE_ACCESS_KEY = process.env.stageAccessKey
const STAGE_SIGN = process.env.stageSign
const ACCESS_EXPIRY = eval(process.env.accessExpiry)
const SESSION_EXPIRY = eval(process.env.sessionExpiry)
const OTP_EXPIRY = eval(process.env.otpExpiry)
const REFRESH_EXPIRY = eval(process.env.refreshExpiry)

class Token {
  constructor (
    userName,
    unixMS,
    sessionExpiry = SESSION_EXPIRY,
    accessExpiry = ACCESS_EXPIRY,
    OTPExpiry = OTP_EXPIRY,
    stageSign = STAGE_SIGN,
    refreshExpiry = REFRESH_EXPIRY,
    stageIV = STAGE_IV,
    stageAccessKey = STAGE_ACCESS_KEY
  ) {
    Object.assign(
      this,
      {
        userName: String(userName),
        unixMS,
        sessionExpiry,
        accessExpiry,
        OTPExpiry,
        stageSign,
        refreshExpiry,
        stageIV,
        stageAccessKey
      })
    this.unixS = Math.round(unixMS / 1000)
  }

  //get userName_key() {
  //  return String(this.userName).slice(-8);
  //}

  get session () {
    const { userName, sessionMessage } = this
    const iv = crypto.randomBytes(16) // Buffer.from("4242424242424242")
    const key = Buffer.alloc(16, 0); Buffer.from(userName).copy(key, 0, 0, 16);
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
    let sessionToken = cipher.update(JSON.stringify(sessionMessage), 'utf8', 'hex')
    sessionToken += cipher.final('hex') + iv.toString('hex') // + 32 hex bytes
    return sessionToken
  }

  get sessionRecord () {
    const { userName, sessionExpiry } = this
    return {
      user: userName,
      expiration: this.setExpiration(sessionExpiry),
      token: this.session,
      type: 'session'
    }
  }

  get sessionMessage () {
    const { unixS, sessionExpiry } = this
    return {
      expiration: this.setExpiration(sessionExpiry),
      request: unixS,
      signature: this.signature(sessionExpiry)
    }
  }

  validateSession (sessionToken) {
    const { userName, unixS, sessionExpiry } = this
    const iv = Buffer.from(sessionToken.slice(-32), "hex"); // 32 hex bytes is 16 bin bytes // Buffer.from("4242424242424242")
    const key = Buffer.alloc(16, 0); Buffer.from(userName).copy(key, 0, 0, 16);
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
    let session = decipher.update(sessionToken.slice(0, -32), 'hex', 'utf8')
    session += decipher.final('utf8')
    const { expiration, signature } = JSON.parse(session)
    if (expiration > unixS /* && signature === this.signature(sessionExpiry) */) {
      return true
    } else {
      return false
    }
  }

  setExpiration (expiry) {
    const { unixMS } = this
    return Math.round((Number(unixMS) + expiry) / 1000)
  }

  signature (expiry) {
    const { stageSign, userName, unixMS } = this
    return crypto
      .createHmac('sha256', stageSign)
      .update(
        JSON.stringify({
          user: userName,
          era: Number(unixMS)
            .toString()
            .slice(0, -(expiry.toString()).length)
        })
      )
      .digest('hex')
  }

  get OTP () {
    return crypto.randomInt(100000, 1000000).toString()
  }

  OTPRecord (OTP) {
    const { userName, unixMS, OTPExpiry } = this
    return {
      expiration: Math.round((Number(unixMS) + OTPExpiry) / 1000),
      token: OTP,
      type: 'otp',
      user: userName
    }
  }

  get refreshToken () {
    const refreshToken = crypto.randomBytes(256).toString('hex')
    return refreshToken
  }

  refreshRecord (token) {
    const { userName, unixMS, refreshExpiry } = this
    return {
      expiration: Math.round((Number(unixMS) + refreshExpiry) / 1000),
      token,
      type: 'refresh',
      user: userName
    }
  }

  get accessToken () {
    const { userName, accessMessage, stageAccessKey, stageIV } = this
    const accessKey = crypto
      .createHmac('sha256', stageAccessKey)
      .update(userName)
      .digest('hex')
    // NB! key and iv for aes256 are 32 byte long
    const cipher = crypto
      .createCipheriv(
        'aes-256-gcm',
        accessKey.slice(16, 48),
        stageIV
      )
    let accessToken = cipher.update(
      JSON.stringify(accessMessage),
      'utf8',
      'base64'
    )
    accessToken += cipher.final('base64')
    // hide auth tag
    accessToken = accessToken.toString().slice(0, 16) + ';' +
      accessToken.toString().slice(16) + ';' +
      cipher.getAuthTag().toString('base64')
    return accessToken
  }

  get accessMessage () {
    const { unixS, accessExpiry } = this
    return {
      expiration: this.setExpiration(accessExpiry),
      request: unixS,
      signature: this.signature(accessExpiry)
    }
  }

  validateAccess (accessToken) {
    const { unixS, userName, stageAccessKey, stageIV, accessExpiry } = this
    // split the auth tag from the end of the token
    const authTag = (accessToken.split(';'))[2]
    accessToken = (accessToken.split(';'))[0] + (accessToken.split(';'))[1]
    // decipher access token
    const accessKey = crypto
      .createHmac('sha256', stageAccessKey)
      .update(String(userName))
      .digest('hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', accessKey.slice(16, 48), stageIV)
    decipher.setAuthTag(Buffer.from(authTag, 'base64')) // auth tag must be a buffer
    let message = decipher.update(accessToken, 'base64', 'utf8')
    message += decipher.final('utf8')
    message = JSON.parse(message)
    const { expiration, signature } = message
    if (expiration > unixS && signature === this.signature(accessExpiry)) {
      return true
    } else {
      return false
    }
  }
}

module.exports = {
  Token
}
