const { checkTotalAmount, checkRepaymentAmount } = require('./helpers')
const { GBP } = require('models')
const MIN_REPAYS = process.env.defaultRepaymentsCount
const MAX_REPAYS = process.env.defaultRepaymentsCount

exports.repaymentsScheme = async (request) => {
  let { totalAmount, number } = request
  totalAmount = new GBP({ pounds: totalAmount }).pennyVal
  const repayment = Math.ceil(totalAmount / number)
  checkTotalAmount(totalAmount)
  checkRepaymentAmount(repayment)
  if (number < MIN_REPAYS) { number = MIN_REPAYS } else if (number > MAX_REPAYS) { number = MAX_REPAYS }
  return {
    repayments_number: number,
    repayments_amount: new GBP({ pence: repayment }).poundVal
  }
}
