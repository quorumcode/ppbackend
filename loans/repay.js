const { GBP } = require('models')
const { LoanClient, UserClient } = require('aws-layer')
const { chargePayment } = require('stripe-layer')

const { checkRepaymentAmount, validateAdvancePayment, validatePaymentMethod, newLoanStateID } = require('./helpers')

const MIN_AMOUNT = process.env.minAmount
const LATE_FEE_FLAT = 500 // TODO change to real env
const LATE_FEE_PERCENTAGE = 0 // TODO

exports.repay = async (request) => {
  console.log(request)
  const { userName, loanID, amount, automated, txID } = request

  // get the current loan state
  const loanTable = new LoanClient(userName)
  const { Items: loanStates } = await loanTable.query(loanID)
  let currentState = loanStates[0]
  for (const state of loanStates) {
    if (state.archived === 0) {
      currentState = state
      break
    }
  }
  if (currentState.balance === 0) { return { balance: currentState.balance } }

  // get repayment in cents for either automated or early repay
  let repayment = 0; let overdueFees = 0
  if (automated) {
    // auto repay don't hold amount but share the txID
    ({ repayment, overdueFees } = getAmountFromTxID(txID, currentState))
  } else {
    repayment = new GBP({ pounds: amount }).pennyVal
    // allow repayment under min amount when trying to repay the total
    if (repayment < currentState.balance) {
      // validate amount
      checkRepaymentAmount(repayment, 11)
    }
  }

  if (repayment > currentState.balance) { repayment = currentState.balance }

  // preview the new state
  let { transactions: newTransactions, balance, total, txIndex } = updatePaymentsSchedule(currentState.transactions, repayment)
  newTransactions = redistributeIllegalAmounts(newTransactions)

  // validate new remaining amounts
  for (const item of newTransactions) {
    if (item.amount > 0 && item.status !== 'paid') {
      checkRepaymentAmount(item.amount, 11)
    }
  }

  // assign relevant payment method
  let paymentMethod = currentState.paymentMethod
  paymentMethod = await validatePaymentMethod(userName, paymentMethod)

  // push current payment to stripe 
  const userTable = new UserClient(userName)
  const { stripeID: customerID } = await userTable.customer()
  try { 
    var { status: repayStatus, id: repayID } = await chargePayment(repayment + overdueFees, customerID, paymentMethod) 
  } finally { 
    await validateAdvancePayment(repayStatus, automated, txID, userName, repayment, overdueFees)
    newTransactions[txIndex].paymentID = repayID
  
    // // disable current tx events and any 0 tx events
    // await disableEvents(newTransactions[txIndex].txID)
    // for (const item of newTransactions) {
    //   if (item.amount === 0) {
    //     await disableEvents(item.txID)
    //   }
    // }
    // TODO instead of that just check if the status paid before triggering an event
  
    // delete 0 tx
    newTransactions = newTransactions.filter(item => item.amount !== 0)
  
    // archive the current loan state
    const lastStateID = currentState.loanStateID
    await loanTable.archiveLoanState(lastStateID)
  
    // post the new loan state
    currentState.transactions = newTransactions
    currentState.total = total
    currentState.balance = balance
    currentState.paymentMethod = paymentMethod
    currentState.archived = 0
    delete currentState.loanStateID
    delete currentState.userID
    await loanTable.putState(
      newLoanStateID(loanID),
      currentState
    )
  
    // return currentState for the receipts
    Object.assign(currentState, { userName })
    return currentState
  }
}

const updatePaymentsSchedule = (transactions, amount) => {
  const unixMS = Date.now()
  const paidTx = transactions.filter(item => item.status === 'paid')
  let remainingTx = transactions.filter(item => item.status !== 'paid')

  // add the repayment as a paid transaction 
  const newTx = {
      txID: `${transactions[0].txID.split('-')[0]}-${transactions[0].txID.split('-')[1]}-${unixMS}`,
      paymentID: 'TBA',
      status: 'paid',
      amount,
      timestamp: unixMS
  }
  paidTx.push(newTx)
  paidTx.sort((a, b) => (a.timestamp - b.timestamp))
  let txIndex = paidTx.length - 1

  // calculate how much of the balance are needed to be adjusted
  const total = Math.abs(transactions[0].amount)
  const balance = Math.abs(paidTx.reduce((accumulator, item) => accumulator + item.amount, 0))

  // don't update remaining tx if balance is paid
  if (remainingTx.length && balance) {
      remainingTx.sort((a, b) => (a.timestamp - b.timestamp))
      // add the difference between the current and the next scheduled repayment to the payment after the next scheduled payment
      // if the next payment is the last one subtract the repayment amount from the next scheduled amount 
      const remainder = remainingTx[0].amount - amount
      if (remainingTx.length === 1) {
          remainingTx[0].amount = remainder
      } else {
          remainingTx[0].amount = 0
          remainingTx[1].amount += remainder
          // since remainder could be negative, check and adjust for any negative values 
          for (let i = 1; i < remainingTx.length; i++) {
              if (remainingTx[i - 1].amount < 0) {
                  remainingTx[i].amount += remainingTx[i - 1].amount
                  remainingTx[i - 1].amount = 0
              }
          }
          // remove all 0 amount transactions
          remainingTx = remainingTx.filter(item => item.amount !== 0)
      }

  } else {
      remainingTx = []
  }

  // merge remaining tx at the end of the paid tx
  paidTx.push(...remainingTx)

  return {
      transactions: paidTx,
      balance,
      total,
      txIndex
  }
}

const redistributeIllegalAmounts = (transactions, minAmount = MIN_AMOUNT) => {
  for (let i = 1; i < transactions.length - 1; i++) {
    const item = transactions[i]
    if (item.amount < minAmount && item.amount > 0 && item.status !== 'paid') {
      transactions[i + 1].amount += item.amount
      transactions[i].amount = 0
      transactions[i].status = 'draft'
    }
  }
  return transactions
}

const getAmountFromTxID = (targetID, loanState, now = Date.now()) => {
  const { transactions, deleted } = loanState
  let amount = 0
  let overdueFees = 0
  if (deleted) {
    throw new Error('Deleted loans not allowed to be repaid.')
  }
  for (const transaction of transactions) {
    const { txID, status, timestamp } = transaction
    // Hotfix 3: only count if NOT overdue -- else counted in the overdue tx section
    if (txID === targetID && status !== 'paid' && timestamp < now && timestamp >= now - 24 * 60 * 60 * 1000) {
      amount += transaction.amount
    }
  }
  // if can't find transaction with matching ID (eg the event only had loan ID but not particular txID) attempt to charge the next unpaid transaction
  if (!amount) {
    for (const transaction of transactions) {
      const { status, timestamp } = transaction
      if (status !== 'paid' && timestamp < now && timestamp >= now - 24 * 60 * 60 * 1000) {
        amount +=  transaction.amount
      }
    }
  }
  // if any overdue amounts present in the loan, add them to the charge + late fee
  const overdueTransactions = transactions.filter(item => item.status !== 'paid' && item.timestamp < now - 24 * 60 * 60 * 1000)
  for (const transaction of overdueTransactions) {
    amount += transaction.amount
    overdueFees += Math.ceil(transaction.amount * LATE_FEE_PERCENTAGE)
    overdueFees += LATE_FEE_FLAT  
  }
  if (!amount) { throw new Error('No applicable payments for auto-repay.') }
  // Hotfix 4: overdueFees total can't be above 10 pounds
  if (overdueFees > 1000) { overdueFees = LATE_FEE_FLAT * 2 }
  return {
    repayment: amount,
    overdueFees
  }
}
