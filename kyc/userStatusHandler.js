const { nanoid } = require('nanoid')
const { UserClient, imageUploader } = require('aws-layer')

const REGION = (process.env.AWSRegion || 'eu-west-2')
const BUCKET = (process.env.bucket || 'user-assets-pp03uat')

const putImages = async (addressFileLink) => {
    const fileName = nanoid()
    await imageUploader(fileName, addressFileLink)
    const url = generateS3Link(fileName)
    return url
}

const generateS3Link = (fileName) => {
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${fileName}.jpg` 
}

const softlockCheck = (status) => {
    let shouldBeSoftlocked = true
    if (status === 'verified') {
        shouldBeSoftlocked = false
    }
    return shouldBeSoftlocked
}

exports.updateIDStatus = async (userID, status, imageData = null, verificationID) => {
    const db = new UserClient(userID)
    let imageLink = null
    console.log(`Catching IDStatus issues; this status: ${status}`)
    if (imageData) {
        imageLink = await putImages(imageData)
    }

    const softlocked = softlockCheck(status)
    if (status == "reviewNeeded"  || status == 'running' || status == 'ReviewNeeded' ) { status = "Under review"}
    await db.updateMultipleFields(
        'status',
        {
            verificationID,
            KYCDate: Math.round(Date.now() / 1000),
            created: Math.round(Date.now() / 1000),
            softlocked,
            idFileLink: imageLink,
            IDStatus: status || (verificationID ? 'verified' : 'In Review')
        }
    )
}

exports.updateAddressStatus = async (userID, status, imageData = null, verificationID) => {
    const db = new UserClient(userID)
    let imageLink = null
    console.log(`Catching addressStatus issues; this status: ${status}`)
    if (imageData) {
        imageLink = await putImages(imageData)
    }
    
    const softlocked = softlockCheck(status)
    if (status == "reviewNeeded"  || status == 'running' || status == 'ReviewNeeded' ) { status = "Under review"}
    await db.updateMultipleFields(
        'status',
        {
            addressVerificationID: verificationID,
            softlocked,
            addressFileLink: imageLink,
            addressStatus: status || (verificationID ? 'verified' : 'rejected')
        }
    )
}

const { createCustomer } = require('stripe-layer')
const { readStatus } = require('./readVerification')
exports.getKYCChecklist = async (userID) => {
    const db = new UserClient(userID)
    const { IDStatus, addressStatus, softlocked, verificationID, addressVerificationID } = await db.status()
    const { emailConfirmed } = await db.details()
    const { count: paymentMethodAdded } = await db.paymentMethod()

    // Hotfix 1: Create stripe user if IDStatus is good 
    let exists = await db.customer()
    exists = exists && !!exists.stripeID && exists.stripeID != 'pending'
    if (!exists && verificationID && addressVerificationID) {
        const details = await db.details()
        const { primaryNumber } = await db.primary()
        if (verificationID) {
          const { id: stripeID } = await createCustomer(details, primaryNumber)
          await db.updateMultipleFields(
            'customer',
            {
              stripeID
            }
          )
        }
    }

    // Hotfix 2: Added status check from mati on get kyc/status 
    try {
        if (!IDStatus) {
            IDStatus = await readStatus(verificationID)
            await db.updateMultipleFields(
                'status',
                {
                    IDStatus
                }
            )
        }
        if (!addressStatus) {
            addressStatus = await readStatus(addressVerificationID)
            await db.updateMultipleFields(
                'status',
                {
                    addressStatus
                }
            )
        }
    } finally {
        return {
            IDStatus: IDStatus ? (legalStatuses.includes(IDStatus) ? capitalise(IDStatus) : 'Under review') : (verificationID && !softlocked ? 'Verified' : 'Unverified'),
            addressStatus: addressStatus ? (legalStatuses.includes(addressStatus) ? capitalise(addressStatus) : 'Under review') : (addressVerificationID ? 'Verified' : 'Unverified'),
            emailConfirmed,
            paymentMethodAdded: !!paymentMethodAdded
        }
    }
}

const legalStatuses = ['Verified', 'verified', 'Unverified', 'unverified', 'Rejected', 'rejected']

const capitalise = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
}