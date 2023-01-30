const {
  CustomerClientResponse,
  stringToBase64,
  getOrigin
} = require('utils')
const response = new CustomerClientResponse(10, 400, 'formErrorState')

const { Request } = require('models')
const { nanoid } = require('nanoid')
const { HttpClient, UserClient, imageUploader } = require('aws-layer')
const USER = process.env.matiUser
const PASS = process.env.matiPass
const authHeaders = {
  Authorization: 'Basic ' + stringToBase64(`${USER}:${PASS}`),
  Accept: 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded'
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

const getVerificationData = async (verificationID, accessToken) => {
  const data = await HttpClient.request(
    'GET',
    `https://api.getmati.com/v2/verifications/${verificationID}`,
    null,
    {
      Authorization: `Bearer ${accessToken}`
    }
  )
  return data
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


const fetchVerificationData = async (identityID, accessToken) => {
  let data = await getVerificationData(identityID, accessToken)
  if (data.name === 'EntityNotFoundError') {
    const verificationID = iID2vID(identityID)
    data = await getVerificationData(verificationID, accessToken)
  }
  return data
}

const extractNameData = (data) => {
  const nameData = {
    givenName: null,
    middleName: null,
    surname: null,
    dob: null
  }
  if (data.documents != null && data.documents.length > 0 && data.documents[0].fields != null) {
    if (data.documents[0].fields.fullName != null && data.documents[0].fields.fullName.value != null) {
      let fullName = data.documents[0].fields.fullName.value.split(' ')
      if (fullName[0] === 'MR' || 'MISS' || 'MSR') { fullName = fullName.slice(1) }
      nameData.surname = fullName[0]
      nameData.givenName = fullName[1]
      if (fullName.length > 2) {
        fullName.splice(0, 2)
        nameData.middleName = fullName.join(' ')
      }
      if (data.documents[0].fields.firstName != null) {
        let firstName = data.documents[0].fields.firstName.value
        if (firstName.indexOf(' ') > -1) {
          firstName = firstName.split(' ')
          if (firstName[0] === 'MR' || 'MISS' || 'MSR') { firstName = firstName.slice(1) }
          [nameData.givenName, nameData.middleName] = [firstName[0], firstName.slice(1).join(' ')]
        } else {
          nameData.givenName = firstName
        }
      }
      if (data.documents[0].fields.surname != null) {
        nameData.surname = data.documents[0].fields.surname.value
      }
      if (data.documents[0].fields.dateOfBirth != null) {
        nameData.dob = String(data.documents[0].fields.dateOfBirth.value)
      }
    }
  }
  return nameData
}

const putAddressImages = async (data, userName, vID) => {
  const userTable = new UserClient(userName)
  let addressFileLink = data.documents[0].photos[0]
  const fileID = nanoid()
  const s3Upload = await imageUploader(fileID, addressFileLink)
  addressFileLink = `https://user-assets-pp03uat.s3.eu-west-2.amazonaws.com/${fileID}.jpg` 
  await userTable.updateMultipleFields(
    'status',
    {
      addressFileLink,
      addressVerificationID: vID
    }
  )
}

const problemCheck = async (data, userName, vID) => {
  const user = new UserClient(userName)

  let s3Upload
  let idFileLink = data.documents[0].photos[0]
  const fileID = nanoid()
  s3Upload = await imageUploader(fileID, idFileLink)
  idFileLink = `https://user-assets-pp03uat.s3.eu-west-2.amazonaws.com/${fileID}.jpg` 

  let softlocked = true
  if (data.identity.status === 'verified') {
    softlocked = false
  }

  await user.updateMultipleFields(
    'status',
    {
      verificationID: vID,
      KYCDate: Math.round(Date.now() / 1000),
      created: Math.round(Date.now() / 1000),
      softlocked,
      blocked: false,
      deleted: false,
      idFileLink
      // addressFileLink
    }
  )
}

const main = async (request) => {
  console.log(request)
  const { userName, vID: identityID, includesID, includesAddress } = request
  const accessToken = await requestAccessToken()
  const data = await fetchVerificationData(identityID, accessToken)
  console.log(data)

  let body = null
  if (includesID || (!includesID && !includesAddress)) {
    body = extractNameData(data)
    await problemCheck(data, userName, identityID)
  }
  if (includesAddress) {
    await putAddressImages(data, userName, identityID)
  }
  return body
}

exports.handler = async (event) => {
  const origin = getOrigin(event)
  try {
    const request = Request.getKYCResource(event)
    const body = await main(request)
    return response.respond(false, body, 200, origin)
  } catch (err) {
    return response.handleError(err, origin)
  }
}
