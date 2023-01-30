const { fetchLoanStats, checkLoanCap, checkAllowanceRemainder } = require('./helpers')

exports.loanCap = async (request) => {
  const { userName } = request
  const { allowanceRemain, activeLoans } = await fetchLoanStats(userName)
  checkLoanCap(activeLoans)
  checkAllowanceRemainder(allowanceRemain)
}
