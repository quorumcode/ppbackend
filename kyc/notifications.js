const { UserClient, APNSService } = require('aws-layer')
exports.sendSilentPush = async (userID, payload) => {
    const db = new UserClient(userID)
    const { devices } = await db.apns()
    if (!!devices && Object.keys(devices).length > 0) {
      const pushService = new APNSService(devices)
      console.log('Sending silent pushes.')
      await pushService.sendKycStatusUpdate(payload)
    }
}
