// TODO remake into a real layer
const { stringToBase64 } = require('utils')
const { HttpClient, UserClient } = require('aws-layer')
const USER = process.env.matiUser
const PASS = process.env.matiPass
const authHeaders = {
  Authorization: 'Basic ' + stringToBase64(`${USER}:${PASS}`),
  Accept: 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded'
}
exports.checkVerificationStatus = async (userName, identityID) => {
  const accessToken = await requestAccessToken()
  let data = await fetchVerificationData(identityID, accessToken) || { name: null, identity: {} }
  if (data.name === 'EntityNotFoundError') {
    const verificationID = iID2vID(identityID)
    data = await fetchVerificationData(verificationID, accessToken)
  }
  const softlocked = checkIdentity(data)
  if (!softlocked) {
    const userTable = new UserClient(userName)
    await userTable.updateMultipleFields(
      'status',
      { softlocked }
    )
  }
  return softlocked
}

// get verificationID which is identityID + 0x2
const iID2vID = (identityID) => {
  let verificationID = identityID.slice(0, identityID.length - 3)
  let suffix = parseInt(
    identityID.slice(
      identityID.length - 3,
      identityID.length),
    16) + 2
  suffix = suffix.toString(16)
  while (suffix.length !== 3) {
    suffix = `0${suffix}`
  }
  verificationID += suffix
  return verificationID
}

const requestAccessToken = async () => {
  const tokenRequest = await HttpClient.request(
    'POST',
    'https://api.getmati.com/oauth',
    'grant_type=client_credentials',
    authHeaders,
    'body',
    'formData'
  )
  return tokenRequest.access_token
}

const fetchVerificationData = async (iID, accessToken) => {
  const data = await HttpClient.request(
    'GET',
    `https://api.getmati.com/v2/verifications/${iID}`,
    null,
    {
      Authorization: `Bearer ${accessToken}`
    }
  )
  return data
}

const checkIdentity = (data) => {
  let softlocked = true
  if (data.identity?.status === 'verified') {
    softlocked = false
  }
  return softlocked
}
