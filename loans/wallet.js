/* eslint-disable no-eval */
const { UserClient, LoanClient, EventClient, APNSService } = require('aws-layer')
const { generateNewCard, newLerexAccount, loadUser, unloadUser, submitToKYC, discoverCards } = require('lerex-layer')
const { PollenError } = require('utils')
const { cardActivationFailure } = require('messages')
const { parseVirtualCardFrame } = require('./virtualCardParser')
const { GBP } = require('models')

const ALLOWANCE = process.env.defaultAllowance
const UNLOCK = eval(process.env.walletUnlockPeriod)
// const MODE = process.env.mode

class Wallet {
  constructor (walletRecord) {
    Object.assign(this, walletRecord)
  }

  static async updateLimit (userName) {
    const userTable = new UserClient(userName)
    const loanTable = new LoanClient(userName)
    // get individual allowance for the user if present
    const { individualAllowance } = await userTable.wallet()
    // set default limit to general or ind allowance
    let limit = (individualAllowance || ALLOWANCE)
    // subtract balances from all active and nondeleted loans 
    let balances = await loanTable.getNonArchivedStates()
    balances = balances.filter(loan => !loan.deleted)
    for (const activeLoan of balances) {
      limit -= activeLoan.balance
    }
    // update the limit in the wallet record
    await userTable.updateMultipleFields(
      'wallet',
      {
        limit
      }
    )
    return limit
  }

  static async checkKYC (request) {
    const { userName } = request
    let proofOfAddressFlow = true
    const userTable = new UserClient(userName)
    const { addressVerificationID, addressFileLink } = await userTable.status()
    if (!addressVerificationID || !addressFileLink) {
      proofOfAddressFlow = false
    }
    return {
      proofOfAddressFlow
    }
  }

  static async generate (request) {
    const { userName } = request
    const userTable = new UserClient(userName)

    // skip if activeCard already 
    const { activeCard } = await userTable.wallet()
    if (activeCard) { return 0 }

    // if (MODE === 'mock') { return 0 }

    let { lerexID } = await userTable.customer()
    const details = await userTable.details()
    const status = await userTable.status()
    // Create a lerex user if none present
    if (!lerexID) {
      lerexID = await newLerexAccount(details, status, userName)
      if (lerexID == null) { throw new PollenError(cardActivationFailure) }
      await userTable.updateMultipleFields(
        'customer',
        { lerexID }
      )
    }
    // Submit KYC docs if not submitted 
    if (!status.lerexKYCSubmitted) {
      await submitToKYC(lerexID, status)
      await userTable.updateMultipleFields(
        'status',
        { lerexKYCSubmitted: true }
      )
    }
    // rediscover existing cards
    const { hasCards, cardData } = await discoverCards(lerexID)
    if (hasCards) {
      const { card, cardFrame } = cardData
      const { cvc, cardNumber } = parseVirtualCardFrame(cardFrame)
      Object.assign(card, { cvc, cardNumber })
      console.log(card)
      await userTable.updateMultipleFields(
        'wallet',
        {
          card,
          lockTimestamp: new Date().toISOString(),
          activeCard: true
        }
      )
      await Wallet.updateLimit(userName)
      return card
    } else {
      // if no card create a new card
      const { card, cardFrame, error, message } = await generateNewCard(lerexID)
      if (error) { throw new PollenError(cardActivationFailure) }
      const { cvc, cardNumber } = parseVirtualCardFrame(cardFrame)
      Object.assign(card, { cvc, cardNumber })
      console.log(card)
      await userTable.updateMultipleFields(
        'wallet',
        {
          card,
          lockTimestamp: new Date().toISOString(),
          activeCard: true
        }
      )
      await Wallet.updateLimit(userName)
      return card
    }
  }

  static async fetch (request) {
    const { userName } = request
    const userTable = new UserClient(userName)
    const { lockTimestamp, limit, card, activeCard } = await userTable.wallet()
    card.cardNumber = Number(card.cardNumber)  
    // card.endYear += 2000
    if (new Date(lockTimestamp) > new Date()) {
      delete card.token
      delete card.cardID
      return {
        limit: GBP.toPounds(limit),
        unlocked: true,
        serverTime: new Date().toISOString(),
        lockTimestamp,
        card
      }
    } else {
      return {
        limit: GBP.toPounds(limit),
        unlocked: false
      }
    }
  }

  static async unlock (request) {
    const { userName } = request
    const userTable = new UserClient(userName)
    const lockTime = Date.now() + UNLOCK

    let limit
    if (Number(userName) !== 123456789) {
      const { lerexID } = await userTable.customer()
      const { lockTimestamp } = await userTable.wallet()
      if (new Date(lockTimestamp) > new Date()) { await unloadUser(lerexID) }
      limit = await Wallet.updateLimit(userName)
      await loadUser(lerexID, GBP.toPounds(limit))
    } else {
      limit = await Wallet.updateLimit(userName)
    }

    await userTable.updateMultipleFields(
      'wallet',
      {
        lockTimestamp: new Date(lockTime).toISOString()
      }
    )

    await EventClient.putEvent(
      `${Number(userName)}-wallet`,
      Math.round(lockTime / 1000),
      'lockWallet'
    )
  }

  static async lock (request) {
    console.log('Got to the locking flow.')
    const { userName, eventTimestamp } = request
    const userTable = new UserClient(userName)

    if (!!eventTimestamp) {
      console.log('Inside event resolutor')
      const eventTable = new EventClient(`${Number(userName)}-wallet`)
      await eventTable.markResolved(
        eventTimestamp,
        'lockWallet'
      )
    }

    console.log('Getting wallet from user')
    const { lockTimestamp } = await userTable.wallet()
    if (new Date(lockTimestamp) > new Date()) {
      console.log('Updating lock time')
      await userTable.updateMultipleFields(
        'wallet',
        {
          lockTimestamp: new Date(Date.now() - 1).toISOString()
        }
      )
      // if (Number(userName) !== 123456789) {
      //   console.log('Posting to lerex')
      //   const { lerexID } = await userTable.customer()
      //   await unloadUser(lerexID)
      // }
    }

    if (Number(userName) !== 123456789) {
      console.log('Posting to lerex')
      const { lerexID } = await userTable.customer()
      await unloadUser(lerexID)
    }

    console.log('Getting devices')
    const { devices } = await userTable.apns()
    if (!!devices && Object.keys(devices).length > 0) {
      const limit = await Wallet.updateLimit(userName)
      const pushService = new APNSService(devices)
      console.log('Sending pushes')
      await pushService.sendWalletUpdate(GBP.toPounds(limit))
    }
  }
}
exports.Wallet = Wallet
