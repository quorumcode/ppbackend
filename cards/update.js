const { setPrimary } = require('./helpers')

exports.update = async (request) => {
  const { userName, pmID, primary } = request
  // if (primary) {
    await setPrimary(userName, pmID)
  // }
}
