const { LoanClient } = require('aws-layer')
const { loanAdapter } = require('./helpers')
const { paginate } = require('utils')
const { Wallet } = require('./wallet')
const { GBP } = require('models')

const ALLOWANCE = process.env.defaultAllowance

exports.fetchList = async (request) => {
  let { userName, list, page, perPage } = request
  const loanTable = new LoanClient(userName)
  let availableToSpend; let amountOwed
  let loans = await loanTable.getNonArchivedStates()
  if (list !== 'balances' && list !== 'purchases') { throw new Error('Invalid list prop.') }
  if (list === 'balances') {
    loans = loans.filter(loan => loan.balance > 0)
    availableToSpend = await Wallet.updateLimit(userName)
    amountOwed = new GBP({ pence: ALLOWANCE - availableToSpend }).poundVal
    availableToSpend = new GBP({ pence: availableToSpend }).poundVal
  }
  const formattedLoans = []
  for (const loan of loans) {
    const thisLoan = await loanAdapter(loan, userName, 'full')
    formattedLoans.push(thisLoan)
  }
  if (!page) { page = 0 }
  if (!perPage) { perPage = 10 }
  const { meta, data } = paginate(formattedLoans, page, perPage, 'snakecase')
  if (list === 'balances') {
    return { availableToSpend, amountOwed, data }
  } else {
    return { meta, data }
  }
}
