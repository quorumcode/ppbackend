const { UserClient } = require('aws-layer')
const { LerexClient } = require('lerex-layer')

const getAllUsersWithCards = async () => {
    const out = []
    const {
        Items
    } = await UserClient.scan()
    for (const record of Items) {
        if (record.activeCard) {
            out.push({
                userID: record.userID
            })
        }
    }
}

exports.unloadEveryCard = async () => {

}

exports.setAuthForEveryCard = async () => {
    // get all lerexIDs and cardIDs
    const { Items: scan } = await UserClient.scan()
    const usersWithCards = {}
    const walletRecords = []
    for (const item of scan) {
        if (item.record === 'customer' && item.lerexID) {
            const userName = item.user
            usersWithCards[userName] = { lerexID: item.lerexID }
        }
        if (item.record === 'wallet' && item.card) {
            walletRecords.push(item)
        }
    }
    for (const item of walletRecords) {
        const userName = item.user
        usersWithCards[userName].cardID = item.card.cardID
    }
    console.log(usersWithCards)

    // call auth update on each lerexID-cardID pair
    for (const pair of Object.values(usersWithCards)) {
        console.log(pair)
        const { lerexID, cardID } = pair
        if (lerexID && cardID) {
             let lerex
            lerex = await LerexClient.builder()
            await lerex.setCardAuthMethods(cardID, lerexID)       
        }
    }
}
