const { CustomerClientResponse, getOrigin } = require('utils')
const response = new CustomerClientResponse()
const { Request } = require('models')

const { readVerification } = require('./readVerification')
const { updateIDStatus, updateAddressStatus, getKYCChecklist } = require('./userStatusHandler')
const { parseMetamapURL, updateStatusFromWebhook } = require('./webhook')
const { sendSilentPush } = require('./notifications')

exports.handler = async (event) => {
    console.log(`Received event: ${JSON.stringify(event)}`)
    const { path } = event
    const origin = getOrigin(event)
    let responseBody
    try {
        switch(path) {
            case '/getkycresource': // legacy method support
                responseBody = await legacyKYC(event)
                break

            case '/kyc/id':
                responseBody = await postID(event)
                break

            case '/kyc/address':
                responseBody = await postAddress(event)
                break
            
            case '/kyc/status':
                responseBody = await getKYCStatus(event)
                break

            case '/kyc/webhook/id':
                responseBody = await webhookHandler({ flow: 'id', ...event })
                break

            case '/kyc/webhook/address':
                responseBody = await webhookHandler({ flow: 'address', ...event })
                break

            default:
                throw new Error('Invalid path.')
        }
    console.log(`Respond body: ${JSON.stringify(responseBody)}`)
    return response.respond(false, responseBody, 200, origin)
    } catch (err) {
    return response.handleError(err, origin)
    }
}

const legacyKYC = async (event) => {
    const { vID, includesAddress} = Request.getKYCResource(event)
    let responseBody
    if (includesAddress) {
        responseBody = await postAddress({
            ... event,
            verificationID: vID
        }) 
    } else {
        responseBody = await postID({
            ... event,
            verificationID: vID
        }) 
    }
    return responseBody
}

// method for uploading the ID of the ID/passport check, returns names+dob for the client to autofill
const postID = async (event) => {
    const { userID, identityID } = Request.postKYC(event)
    const { nameData, imageData, status, verificationID } = await readVerification(identityID)
    await updateIDStatus(userID, status, imageData, verificationID)
    return nameData
}

// method for uploading the ID of the proof of address check
const postAddress = async (event) => {
    const { userID, identityID } = Request.postKYC(event)
    const { imageData, status, verificationID } = await readVerification(identityID)
    await updateAddressStatus(userID, status, imageData, verificationID)
    return null
}

// method for returning a checklist of items that prevent user from making purchases
const getKYCStatus = async (event) => {
    const { userID } = Request.generic(event)
    const { IDStatus, addressStatus, emailConfirmed, paymentMethodAdded } = await getKYCChecklist(userID)
    return { IDStatus, addressStatus, emailConfirmed, paymentMethodAdded }
}

// webhook listener to update IDstatus and addressStatus when Metamap changes their values 
const webhookHandler = async (event) => {
    const { matiDashboardUrl, status, eventName, flow } = Request.metamapWebhook(event)
    switch (eventName) {
        case 'verification_completed':
        case 'verification_updated':
            // parse metamap URL
            const { identityID, verificationID } = parseMetamapURL(matiDashboardUrl)
            // update the statuses in the DB, return userID for the push notifications
            const { userID } = await updateStatusFromWebhook(identityID, verificationID, flow, status)
            // send kyc status object as a silent push
            const payload = await getKYCChecklist(userID)
            await sendSilentPush(userID, payload)
            break
        
        default:
            console.log(`Unhandled Metamap webhook event: ${event.body}`)
    }
    return null
}
