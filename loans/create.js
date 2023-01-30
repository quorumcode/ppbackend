/* eslint-disable no-eval */
const {
  checkTotalAmount,
  checkRepaymentAmount,
  fetchLoanStats,
  checkLoanCap,
  checkAllowedToSpend,
  formBaseLoanID,
  newLoanStateID,
  generateReferenceCode,
  validateAdvancePayment,
  formPollenReference,
  validatePayoutReceipt,
  minuteToMidnight,
  halfEleven,
  validateAdvancePaymentForVirtualCards
} = require('./helpers')
const { GBP } = require('models')
const { PollenError } = require('utils')
const { paymentFailed } = require('messages')
const { UserClient, LoanClient, MerchantClient, EventClient, APNSService } = require('aws-layer')
const { chargePayment } = require('stripe-layer')
const { makePayment } = require('lerex-layer')
const { Wallet } = require('./wallet')

const PERIOD = eval(process.env.defaultPeriod)
const MODE = process.env.mode
const REM1 = eval(process.env.firstReminderSecondsBefore)
const REM2 = eval(process.env.secondReminderSecondsBefore)
const ADV_DELAY = 2 * 24 * 60 * 60 * 1000

exports.create = async (request) => {

  throw new PollenError({
    message: 'Sorry, but new loan creation is temporarily unavailable.',
    errorCode: 10,
    errorDisplay: 'modal',
    statusCode: 400
  })

  const {
    userName,
    number,
    repaymentAmount,
    serviceIDs,
    customAmount,
    customNote,
    merchantID,
    pmID,
    customItems,
    otherMerchant,
    fromVirtualCard,
    dontChargeMerchant,
    dontChargeAdvance
  } = request
  let { pollenReference } = request
  const unixMS = Math.round(Date.now())

  const total = new GBP({ pounds: number * repaymentAmount }).pennyVal
  const repayment = new GBP({ pounds: repaymentAmount }).pennyVal
  if (!fromVirtualCard) {
    const { allowanceRemain, activeLoans } = await fetchLoanStats(userName)
    checkTotalAmount(total, allowanceRemain)
    checkRepaymentAmount(repayment)
    checkLoanCap(activeLoans)
    checkAllowedToSpend(allowanceRemain, total)
  }


  const loanID = formBaseLoanID(unixMS)
  pollenReference = (pollenReference || formPollenReference(unixMS))
  const newLoan = {
    fullID: loanID,
    archived: 0,
    created: unixMS,
    pollenReference,
    paymentMethod: null,
    merchantID: (merchantID || false),
    otherMerchant: (otherMerchant || false),
    referenceCode: generateReferenceCode(),
    balance: total,
    total: total,
    overdue: false,
    items: (serviceIDs || []),
    customItems: (customItems || []),
    transactions: []
  }

  if (customAmount) {
    newLoan.customItems.push({
      name: (customNote || 'Custom Amount'),
      imageLink: 'https://logo.clearbit.com/https:/pollenpay.com/',
      price: customAmount,
      qty: 1
    })
  }

  // pay advance or delay if using virtual card
  let delayAdvancePayment = false
  const userTable = new UserClient(userName)
  const { stripeID: customerID, primaryPaymentMethod } = await userTable.customer()
  let paymentMethod = pmID
  if (!pmID) { paymentMethod = primaryPaymentMethod }
  Object.assign(newLoan, { paymentMethod })
  if (!dontChargeAdvance) {
    try {
      var { status: advanceStatus, id: advanceID } = await chargePayment(repayment, customerID, paymentMethod)
      validateAdvancePayment(advanceStatus) // temp workaround not to allow incomplete payments through
    } catch {
      if (fromVirtualCard) {
        delayAdvancePayment = validateAdvancePaymentForVirtualCards(advanceStatus)
      } else {
        throw new PollenError(paymentFailed)
      }
    }
  } else {
    console.log('[Create loan] Not charging the advance!')
    advanceID = 'TBA'
  }

  // Payout to merchant if direct merchant
  if (MODE === 'prod' && !!merchantID && !dontChargeMerchant) {
    const merchantTable = new MerchantClient(merchantID)
    const { billing } = await merchantTable.getUser()
    const payout = await makePayment(
      GBP.toPounds(total * (1 - billing.commission)),
      billing,
      pollenReference
    )
    console.log(`[Create loan] Payout: ${payout}`)
    // validatePayoutReceipt(payout)
  // TODO refund on Lerex failure
  }

  newLoan.transactions.push({
    txID: `${Number(userName)}-${loanID}-0`,
    amount: -1 * total,
    timestamp: unixMS,
    status: 'paid',
    paymentID: 'TBA'
  })

  // if delay schedule the payment else update the balance
  if (delayAdvancePayment === true) {
    const timestamp = unixMS + ADV_DELAY
    const txID = `${Number(userName)}-${loanID}-${timestamp}`
    newLoan.transactions.push({
      txID,
      amount: repayment,
      timestamp,
      status: 'scheduled',
      paymentID: advanceID
    })

    const triggerTime = Math.round(minuteToMidnight(timestamp) / 1000)
    await EventClient.putEvent(
      txID,
      triggerTime,
      'pay'
    )
  } else {
    newLoan.transactions.push({
      txID: `${Number(userName)}-${loanID}-${unixMS}`,
      amount: repayment,
      timestamp: unixMS,
      status: 'paid',
      paymentID: advanceID
    })
    newLoan.balance -= repayment
  }

  const upcomingPayments = []
  for (let i = 1; i < number; i++) {
    const timestamp = unixMS + PERIOD * i
    upcomingPayments.push({
      txID: `${Number(userName)}-${loanID}-${timestamp}`,
      amount: repayment,
      timestamp,
      status: 'draft',
      paymentID: 'TBA'
    })
  }
  for (const item of upcomingPayments) {
    let triggerTime = Math.round(minuteToMidnight(item.timestamp) / 1000)
    await EventClient.putEvent(
      item.txID,
      triggerTime,
      'pay'
    )
    triggerTime = Math.round(halfEleven(item.timestamp) / 1000)
    await EventClient.putEvent(
      item.txID,
      triggerTime - REM1,
      'reminder1'
    )
    await EventClient.putEvent(
      item.txID,
      triggerTime - REM2,
      'reminder2'
    )
    item.status = 'scheduled'
    if (item.amount === 0) {
      item.status = 'paid'
    }
    newLoan.transactions.push(item)
  }

  Object.assign(newLoan, { delayAdvancePayment })

  const loanTable = new LoanClient(userName)
  await loanTable.putState(
    newLoanStateID(loanID),
    newLoan
  )
  newLoan.userName = userName
  return {
    loanID,
    loanState: newLoan
  }
}