const { UserClient, APNSService } = require('aws-layer')

const USERS = [447596955453]
const PAYLOAD = {
  "aps": {
    "alert": "Thank you for supporting PollenPay!"
  },
  "type": "promo"
}

exports.handler = async () => {
  const tokens = await collectTokens(USERS)
  const apns = new APNSService(['0f2854b150f387a7ac206e012168e1e2a8968fd79eec7b80bee9b922b145a4c4'])
  await apns.sendPush(PAYLOAD)
  return tokens
}

const collectTokens = async (users = 'all') => {
  const tokens = []
//   const { Items: scan } = await UserClient.scan()
//   let tokens = ''
//   for (const item of scan) {
//     if (item.record === 'apns') {
//       for (const device of Object.values(item.devices)) {
//         tokens += `${device[0]},`
//       }
//     }
//   }
  for (const userName of users) {
    const userTable = new UserClient(userName)
    let exists 
        exists = await userTable.customer()
    const { devices } = await userTable.apns()
    for (const deviceTokens of Object.values(devices)) {
      tokens.push(...deviceTokens) 
    }
  }
  return tokens
}