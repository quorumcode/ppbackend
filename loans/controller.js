const { CustomerClientResponse, getOrigin } = require('utils')
const response = new CustomerClientResponse()

const { Request } = require('models')
const { create } = require('./create')
const { fetch } = require('./fetch')
const { loanParams } = require('./loanParams')
const { repaymentsScheme } = require('./repaymentsScheme')
const { loanCap } = require('./loanCap')
const { fetchList } = require('./fetchList')
const { repay } = require('./repay')
const { Wallet } = require('./wallet')
const { handleWebhooks } = require('./webhooks')
const { Notifications } = require('./notifications')
const { getLoanState, handleSoftlock } = require('./helpers')
const { unloadEveryCard, setAuthForEveryCard } = require('./maintenance')

exports.handler = async (event) => {
  console.log(`Received event: ${JSON.stringify(event)}`)
  const { path } = event
  const origin = getOrigin(event)
  let responseBody
  try {
    switch (path) {
      case '/postloan':
        responseBody = await postLoan(event)
        break

      case '/getloan':
        responseBody = await getLoan(event)
        break

      case '/getparams':
        responseBody = await getParams()
        break

      case '/getrepaymentsscheme':
        responseBody = await getRepaymentsScheme(event)
        break

      case '/checkloancap':
        responseBody = await checkLoanCap(event)
        break

      case '/getpurchases':
      case '/getPurchases':
        responseBody = await getPurchases(event)
        break

      case '/earlyrepay':
        responseBody = await earlyRepay(event)
        break

      case '/wallet/activate':
        // responseBody = await activateCard(event)
        responseBody = 0
        break

      case '/wallet/checkkyc':
        responseBody = await walletCheckKYC(event)
        break

      case '/wallet/unlock':
        responseBody = await unlockCard(event)
        break

      case '/wallet':
        responseBody = await getCard(event)
        break

      case '/webhook':
        responseBody = await webhookHandler(event)
        break

      case 'LAMBDA_LOCK_WALLET':
        await lockWallet(event)
        responseBody = null
        break

      case 'LAMBDA_PAY':
        await autoRepay(event)
        break

      case 'LAMBDA_SEND_RECEIPT':
        await autoReceipt(event)
        break

      case 'LAMBDA_SEND_REMINDER_1':
        await sendReminder1(event)
        break

      case '/maintenance/unloadEveryCard':
        await unloadEveryCard()
        break

      case '/maintenance/getAllCardIDs':
        break

      case '/maintenance/updateAllCards3DS':
        await setAuthForEveryCard()
        break

      default:
        throw new Error('Invalid path.')
    }
    console.log(`Respond body: ${JSON.stringify(response)}`)
    return response.respond(false, responseBody, 200, origin)
  } catch (err) {
    return response.handleError(err, origin)
  }
}

const postLoan = async (event) => {
  const request = Request.postLoan(event)
  await handleSoftlock(request)
  const { loanID, loanState } = await create(request)
  const responseBody = await fetch({ ...request, loanID }, 'receipt')
  // await Wallet.lock({ request })
  await Notifications.sendNewLoanConfirmations(loanState)
  return responseBody
}

const getLoan = async (event) => {
  const request = Request.getLoan(event)
  const responseBody = await fetch(request)
  return responseBody
}

const getParams = async () => {
  const responseBody = await loanParams()
  return responseBody
}

const getRepaymentsScheme = async (event) => {
  const request = Request.getRepaymentsScheme(event)
  const responseBody = await repaymentsScheme(request)
  return responseBody
}

const checkLoanCap = async (event) => {
  const request = Request.checkLoanCap(event)
  await loanCap(request)
  await handleSoftlock(request)
  return null
}

const getPurchases = async (event) => {
  const request = Request.getPurchases(event)
  const responseBody = await fetchList(request)
  return responseBody
}

const earlyRepay = async (event) => {
  const request = Request.earlyRepay(event)
  const loanState = await repay(request)
  await Notifications.sendReceipt(loanState, false)
  // await Wallet.lock({ request })
  const responseBody = await fetch(request)
  return responseBody
}

const autoRepay = async (event) => {
  const request = Request.transactionEvent(event)
  const loanState = await repay(request)
  if (!!loanState.total) { await Notifications.sendReceipt(loanState, true) } // not to send receipts on already closed payments in error
}

const autoReceipt = async (event) => {
  const { userName, loanID } = Request.transactionEvent(event)
  const loanState = await getLoanState(userName, loanID)
  loanState.userName = loanState.userID
  await Notifications.sendReceipt(loanState)
}

const activateCard = async (event) => {
  const request = Request.activateCard(event)
  await handleSoftlock(request)
  await Wallet.generate(request)
  const responseBody = await Wallet.fetch(request)
  return responseBody
}

const getCard = async (event) => {
  const request = Request.getCard(event)
  const responseBody = await Wallet.fetch(request)
  return responseBody
}

const unlockCard = async (event) => {
  // return null
  throw new Error('Maintenance is under way.')
  const request = Request.unlockCard(event)
  await handleSoftlock(request)
  // await Wallet.lock(request)
  await Wallet.unlock(request)
  const responseBody = await Wallet.fetch(request)
  return responseBody
}

const lockWallet = async (event) => {
  const request = Request.lockWallet(event)
  await Wallet.lock(request)
}

const webhookHandler = async (event) => {
  const request = Request.webhookHandler(event)
  console.log(`[Webhook handler] Formatted request: ${JSON.stringify(request)}`)
  const { userName, responseBody } = await handleWebhooks(request)
  if ( userName ) {
    await Wallet.lock({ userName })
  }
  if (responseBody) {
    return responseBody
  }
  return {}
}

// tells the client if the user has undergone the proof of address check
const walletCheckKYC = async (event) => {
  const request = Request.walletCheckKYC(event)
  await handleSoftlock(request)
  const responseBody = await Wallet.checkKYC(request)
  return responseBody
}

const sendReminder1 = async (event) => {
  const { userName, loanID } = Request.transactionEvent(event)
  const loanState = await getLoanState(userName, loanID)
  loanState.userName = loanState.userID
  await Notifications.sendReminder1(loanState)
}
