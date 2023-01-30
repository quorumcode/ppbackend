const { MetamapClient } = require('metamap-layer')

exports.readVerification = async (identityID) => {
    const {
        status,
        nameData,
        imageData,
        verificationID
    } = await MetamapClient.builder()
        .then((verification) => verification.processIdentityID(identityID))
        .then((verification) => verification.extractNameData())
        .then((verification) => verification.extractImageData())
        .then((verification) => verification.extractStatus())
    return { nameData, imageData, status, verificationID }
}

// Hotfix 2: Added status check from mati on get kyc/status 
exports.readStatus = async (identityID) => {
    const { 
        status 
    } = await MetamapClient.builder()
        .then((verification) => verification.processIdentityID(identityID))
        .then((verification) => verification.extractStatus())
    return status
}