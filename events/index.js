const { EventClient, invokeFunction } = require('aws-layer')

const LOCK_WALLET = process.env.lockWalletFunction
const LOAN_SERVICE = process.env.loanServiceFunction

class EventHandler {
  constructor () {
    this.unixS = Math.round(Date.now() / 1000)
  }

  async handle (eventType, path, functionName = LOAN_SERVICE) {
    console.log(`Querying ${eventType} events...`)
    const { unixS } = this
    const events = await EventClient.queryTypeIndex(
      eventType,
      unixS
    )
    console.log(events)
    if (events.count) {
      for (const item of events.items) {
        await invokeFunction(functionName, {
          path,
          ...item
        })
        await EventClient.markResolvedAny(item)
      }
    }
  }

  async batchHandle (setsOfParams) {
    for (const params of setsOfParams) {
      await this.handle(...params)
    }
  }
}

exports.handler = async () => {
  const events = new EventHandler()
  await events.batchHandle([
    ['lockWallet', 'LAMBDA_LOCK_WALLET'],
    ['sendReceipt', 'LAMBDA_SEND_RECEIPT'],
    ['pay', 'LAMBDA_PAY'],
    ['reminder1', 'LAMBDA_SEND_REMINDER_1'],
    ['reminder2', 'LAMBDA_SEND_REMINDER'],
    ['reminder3', 'LAMBDA_SEND_REMINDER'],
    ['delay1', 'LAMBDA_DELAY'],
    ['delay2', 'LAMBDA_DELAY'],
    ['defcon', 'LAMBDA_DEFCON']
  ])
}

// exports.handler = async () => {
//   const unixS = Math.round(Date.now() / 1000)
//   let events = []

//   events = await EventClient.queryTypeIndex(
//     'lockWallet',
//     unixS
//   )
//   console.log(events)
//   if (events.count) {
//     for (const item of events.items) {
//       await invokeFunction(LOCK_WALLET, {
//         path: 'LAMBDA_LOCK_WALLET',
//         ...item
//       })
//     }
//   }
// }
