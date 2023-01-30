exports.parseMetamapURL = (url) => {
    // metamap dahsboard links follow format ${host}/identity/${identityID}/verification/${verificationID}
    const path = new URL(String(url))
        .pathname
        .split('/')
        .filter(i => !!i)
    // if parsed path length is not even, the format is wrong and we dunno who to assign identityIDs
    if (path.length % 2 === 1) { throw new Error(`Couldn't parse identityID: ${url} doesn't look like a Metamap link.`) }
    // assume that the path consists of a prop name followed by an id, iterating through the path and returning all IDs
    let identityID = null; let verificationID = null
    for (let i = 0; i < path.length; i += 2) {
        if (path[i] === 'identity') {
            identityID = path[i+1]
        } else if (path[i] === 'verification') {
            verificationID = path[i+1]
        }
    }
    console.log(`Extracted idenity ${identityID} and verification ${verificationID}`)
    return {
        identityID,
        verificationID
    }
}

const { UserClient } = require('aws-layer')
const VERIFIED = ['verified', 'Verified'] // TODO: turn all statuses everywhere into a const list
exports.updateStatusFromWebhook = async (identityID, verificationID, flowName, status) => {
    // specify if you need to find userID based on verificationID or by addressVerificationID
    const verificationProps = { id: 'verificationID', address: 'addressVerificationID'}
    // Query user by verificationID
    let { userTable: db, userName } = await UserClient.fromVerificationID(verificationID, verificationProps[flowName])
    // if verificationID is off, try identityID
    if (!userName) { ({ userTable: db, userName } = await UserClient.fromVerificationID(identityID, verificationProps[flowName])) }
    console.log(`User matched ${userName}`)
    const { IDStatus, addressStatus } = await db.status()
    switch (flowName) {
        case 'id':
            await db.updateMultipleFields(
                'status',
                {
                    softlocked: (VERIFIED.includes(status) ||  VERIFIED.includes(addressStatus)),
                    IDStatus: status,
                    identityID,
                    verificationID
                }
            )
            break

        case 'address':
            await db.updateMultipleFields(
                'status',
                {
                    softlocked: (VERIFIED.includes(status) ||  VERIFIED.includes(IDStatus)),
                    addressStatus: status,
                    addressIdentityID: identityID,
                    addressVerificationID: verificationID
                }
            )
            break
    }
    return { userID: userName }
}
