const MIN_TOTAL = process.env.minTotalAmount
const MAX_TOTAL = process.env.maxTotalAmount
const MIN_AMOUNT = process.env.minAmount

const { GBP } = require('models')

exports.loanParams = async () => {
  const amounts = {
    minAmount: MIN_AMOUNT,
    minTotalAmount: MIN_TOTAL,
    maxTotalAmount: MAX_TOTAL
  }
  for (const key of Object.keys(amounts)) {
    amounts[key] = new GBP({ pence: amounts[key] }).poundVal
  }
  return {
    time: new Date().toISOString(),
    ...amounts
  }
}
