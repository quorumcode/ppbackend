const { LoanClient } = require('aws-layer')
const { loanAdapter } = require('./helpers')

exports.fetch = async (request, view = 'full') => {
  const { loanID, userName } = request
  const loanTable = new LoanClient(userName)
  const { Items: loanStates } = await loanTable.query(loanID)
  let currentState = loanStates[0]
  for (const state of loanStates) {
    if (state.archived === 0) {
      currentState = state
      break
    }
  }
  currentState = await loanAdapter(currentState, userName, view)
  return currentState
}
