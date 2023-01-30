const { nanoid, customAlphabet } = require('nanoid')
const { UserClient, LoanClient, MerchantClient, EventClient } = require('aws-layer')
const { PollenError, Base36 } = require('utils')
const {
    invalidTotal,
  repaymentAmountMinMax,
  overduePaymentsPresent,
  loanCapReached,
  spendingLimitReached,
  paymentFailed,
  payoutFailed,
  insufficientAllowance,
  noPaymentMethod,
  softLocked,
  emailNotConfirmed
} = require('messages')
const { GBP, User, Merchant } = require('models')
const { Notifications } = require('./notifications')
const { checkVerificationStatus } = require('./metamapLayer')

const MIN_TOTAL = process.env.minTotalAmount
const MAX_TOTAL = process.env.maxTotalAmount
const MIN_AMOUNT = process.env.minAmount
const ALLOWANCE = process.env.defaultAllowance
const LOAN_CAP = process.env.loanCap

exports.checkTotalAmount = (amountTotal) => {
  if ((MIN_TOTAL > amountTotal) || (MAX_TOTAL < amountTotal)) {
    throw new PollenError(invalidTotal(MIN_TOTAL, MAX_TOTAL))
  }
}

exports.checkAllowanceRemainder = (allowanceRemain) => {
  if (allowanceRemain < MIN_TOTAL) {
    throw new PollenError(insufficientAllowance(MIN_TOTAL))
  }
}

exports.checkRepaymentAmount = (repaymentAmount, desiredErrorCode = 0 ) => {
  if (repaymentAmount < MIN_AMOUNT) {
    throw new PollenError(repaymentAmountMinMax(MIN_AMOUNT, desiredErrorCode))
  }
}

exports.fetchLoanStats = async (userName) => {
  const userTable = new UserClient(userName)
  const loanTable = new LoanClient(userName)
  const loans = await loanTable.getNonArchivedStates()
  let activeLoans = 0
  const wallet = await userTable.wallet()
  let allowanceRemain = (wallet && (null != wallet.individualAllowance)) ? wallet.individualAllowance : ALLOWANCE
  loans.forEach(loan => {
    if (loan.balance > 0) {
      activeLoans++
      allowanceRemain -= loan.balance
    }
    if (loan.overdue) {
      throw new PollenError(overduePaymentsPresent)
    }
  })
  return {
    activeLoans,
    allowanceRemain
  }
}

exports.checkLoanCap = (loanCount) => {
  if (loanCount >= LOAN_CAP) {
    throw new PollenError(loanCapReached(LOAN_CAP))
  }
}

exports.checkAllowedToSpend = (allowanceRemain, amount) => {
  if (allowanceRemain < amount) {
    throw new PollenError(spendingLimitReached(allowanceRemain))
  }
}

exports.formBaseLoanID = (loanTimestampS) => {
  return `${loanTimestampS}`
}

exports.newLoanStateID = (baseLoanID) => {
  return `${baseLoanID}-${nanoid()}`
}

exports.generateReferenceCode = () => {
  return customAlphabet('346789ABCDEFGHJKLMNPQRTUVWXY', 4)()
}

// create event for tomorrow to attempt to charge the card in case of payment failure
const scheduleNextPaymentAttempt = async (txID) => {
  const tomorrow = Math.round(Date.now() / 1000) + 7 * 24 * 60 * 60
  await EventClient.putEvent(
    txID,
    tomorrow,
    'pay'
  )
}

exports.validateAdvancePayment = async (status, automated, txID, phone, repayment, overdueFees) => {
  if (status !== 'succeeded') {
    if (automated) {
      await scheduleNextPaymentAttempt(txID)
      await Notifications.handlePaymentFailure(phone, repayment, overdueFees)
    }
    throw new PollenError(paymentFailed)
  }
}

exports.validateAdvancePaymentForVirtualCards = (status) => {
  let delayAdvancePayment = false
  if (status !== 'succeeded') {
    delayAdvancePayment = true
  }
  return delayAdvancePayment
}

exports.formPollenReference = (numericID) => {
  return Base36.encodeWithSeparators(numericID)
}

exports.validatePayoutReceipt = (payout) => {
  if (!payout) { throw new PollenError(payoutFailed) }
}

const daysLeft = (timestampSeconds, next = false) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  let res = `${new Date(timestampSeconds * 1000).getDate()} ${months[new Date(timestampSeconds * 1000).getMonth()]}`
  if (next) {
    const days = daysDiff(timestampSeconds * 1000, Number(new Date()))
    if (days >= 60) {
      res += ` (in ${daysToMonths(days)} months)`
    } else if (days >= 30) {
      res += ' (in a month)'
    } else if (days >= 14) {
      res += ` (in ${daysToWeeks(days)} weeks)`
    } else if (days > 7) {
      res += ' (in a week)'
    } else if (days > 1) {
      res += ` (in ${days} days)`
    } else if (days === 1) {
      res += ' (tomorrow)'
    } else if (days === 0) {
      res += ' (today)'
    } else {
      res += ` (${-1 * days} days ago)`
    }
  }
  return res
}
exports.daysLeft = daysLeft

const daysDiff = (date2, date1) => {
  return Math.ceil((date2 - date1) / (1000 * 60 * 60 * 24))
}

const daysToWeeks = (days) => {
  return Math.floor(days / 7)
}

const daysToMonths = (days) => {
  return Math.floor(days / 30)
}

const productAdapter = (productObject) => {
  const { name, imageURL, totalPrice } = productObject
  return {
    name,
    imageLink: imageURL,
    price: totalPrice,
    qty: 1
  }
}

const transactionAdapter = (transaction) => {
  const { amount, status, timestamp } = transaction
  return {
    amount: new GBP({ pence: amount }).poundVal,
    paid: status === 'paid',
    due: new Date(timestamp).toISOString(),
    daysLeft: daysLeft(Math.round(timestamp / 1000))
  }
}

exports.loanAdapter = async (loanObject, userName, view = 'full') => {
  const { created, merchantID, otherMerchant, items, customItems, pollenReference, referenceCode, total, balance, paymentMethod, transactions, overdue, deleted, adjustments } = loanObject

  const purchasedItems = []
  let merchantTable = {}
  if (merchantID) {
    merchantTable = new MerchantClient(merchantID)
    for (let i = 0; i < items.length; i++) {
      const productID = items[i]

      let product = await merchantTable.query(`product-${productID}`)
      if (!product.Count) { continue }
      product = product.Items[0]
      purchasedItems.push({
        ...productAdapter(product),
        index: i
      })
    }
  }
  if (!!customItems && customItems.length > 0) {
    for (const item of customItems) {
      const index = purchasedItems.length
      purchasedItems.push({
        ...item,
        index
      })
    }
  }

  const userTable = new UserClient(userName)
  let { Items: paymentMethodDetails, Count: pmCount } = await userTable.queryStrict(`paymentMethod-${paymentMethod}`)
  if (!pmCount) {
    const { primaryPaymentMethod } = await userTable.customer()
    paymentMethodDetails = await userTable.queryStrict(`paymentMethod-${primaryPaymentMethod}`)
    paymentMethodDetails = paymentMethodDetails.Items
  }
  paymentMethodDetails = paymentMethodDetails[0]

  let merchantName = `Purchase ${pollenReference}` // if no way to ID the merchant just use the reference
  let category = 'Virtual Card Purchase'
  let logoURL = ''
  const contactDetails = {
    email: 'support@pollenpay.com'
  }
  if (merchantID) {
    const { Items: merchantDetails } = await merchantTable.query()
    const { merchantName: directMerchantName, logoURL: directLogoURL, category: directCategory } = merchantDetails[0]
    merchantName = directMerchantName
    logoURL = directLogoURL
    category = Merchant.categoriesEnum[directCategory]
  } else {
    // if other merchant, eg virtual card, then limit length to 26 chars
    merchantName = String(otherMerchant).slice(0,26)
  }

  let status = 1
  if (deleted) { status = 2 } else {
    if (balance > 0) { status = 0 }
  }

  const formattedTransactions = []
  transactions.shift()
  for (let i = 0; i < transactions.length; i++) {
    formattedTransactions.push({
      ...transactionAdapter(transactions[i]),
      index: i
    })
  }

  let upcomingDueDate
  let daysLeftNext
  for (const tx of formattedTransactions) {
    if (!tx.paid) {
      upcomingDueDate = Number(new Date(tx.due))
      tx.daysLeft = daysLeft(Math.round(new Date(tx.due) / 1000), true)
      daysLeftNext = tx.daysLeft
      break
    }
  }

  const summary = {
    shipping: 0,
    discount: 0,
    total: new GBP({ pence: total }).poundVal,
    items: purchasedItems
  }

  if (adjustments) { Object.assign(summary, { adjustments }) }

  const user = new User()
  const info = {
    purchaseDate: new Date(created).toISOString(),
    referenceCode,
    paymentMethod: {
      type: user.paymentMethodTypes[paymentMethodDetails.type],
      lastDigits: paymentMethodDetails.digits
    },
    pollenReference: pollenReference.toString(), // coerce into string
    category,
    contactDetails
  }

  let thisLoan = {}
  switch (view) {
    case 'receipt':
      thisLoan = {
        loan_id: `${created}`,
        summary,
        info
      }
      break

    case 'full':
      thisLoan = {
        created: new Date(created).toISOString(),
        id: `${created}`,
        merchant_name: merchantName,
        icon_link: logoURL,
        totalAmount: GBP.toPounds(total),
        balance: GBP.toPounds(balance),
        user: userName,
        status,
        overdue: `${Number(overdue)}`,
        pmID: paymentMethod,
        transactions: formattedTransactions,
        summary,
        info,
        upcomingDueDate,
        daysLeft: daysLeftNext
      }
  }
  return thisLoan
}

exports.validatePaymentMethod = async (userName, pmID) => {
  const userTable = new UserClient(userName)
  const { count, items: savedCards } = await userTable.paymentMethod()
  if (!count) { throw new PollenError(noPaymentMethod) }
  for (const item of savedCards) {
    if (item.pmID === pmID) {
      return pmID
    }
  }
  const { primaryPaymentMethod } = await userTable.customer()
  if (!primaryPaymentMethod) { throw new PollenError(noPaymentMethod) }
  return primaryPaymentMethod
}

exports.disableEvents = async (txID) => {
  const eventTable = new EventClient(txID)
  const { Items: eventsToDisable, Count } = eventTable.query()
  if (Count) {
    for (const event of eventsToDisable) {
      const { txID, timestamp } = event
      await EventClient.putEvent(
        txID,
        timestamp,
        'disabled'
      )
    }
  }
}

exports.formFullName = (nameObject) => {
  let name = nameObject.givenName
  if ('surname' in nameObject) {
    name += ` ${nameObject.surname}`
  }
  return name
}

exports.latestPaidTransaction = (transactions) => {
  transactions.sort((a, b) => (a.timestamp - b.timestamp))
  const paidTransactions = transactions.filter(item => item.status === 'paid')
  return paidTransactions.pop()
}

exports.getLoanState = async (userName, loanID) => {
  const loanTable = new LoanClient(userName)
  const { Items: loanStates } = await loanTable.query(loanID)
  let currentState = loanStates[0]
  for (const state of loanStates) {
    if (state.archived === 0) {
      currentState = state
      break
    }
  }
  return currentState
}

exports.minuteToMidnight = (timestampMS) => {
  return Number(
    new Date(
      `${new Date(timestampMS).toISOString().split('T')[0]}T23:59:00.000Z`
    )
  )
}

exports.halfEleven = (timestampMS) => {
  return Number(
    new Date(
      `${new Date(timestampMS).toISOString().split('T')[0]}T11:30:00.000Z`
    )
  )
}

const getCards = async (userName) => {
  const userTable = new UserClient(userName)
  const { items, count } = await userTable.paymentMethod()
  return {
    items,
    count
  }
}

const requirePaymentMethod = async (request) => {
  const { userName } = request
  const { count } = await getCards(userName)
  if (!count) { throw new PollenError(noPaymentMethod) }
}

exports.handleSoftlock = async (request) => {
  const { userName } = request
  await requirePaymentMethod({ userName })
  const userTable = new UserClient(userName)
  let { softlocked, verificationID } = await userTable.status()
  const { emailConfirmed } = await userTable.details()
  if (softlocked && verificationID) {
    softlocked = await checkVerificationStatus(userName, verificationID)
  }
  if (softlocked) {
    throw new PollenError(softLocked)
  }
  if (!emailConfirmed) {
    throw new PollenError(emailNotConfirmed)
  }
}
