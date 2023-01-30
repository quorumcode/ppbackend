const {
  UserClient,
  // LoanClient,
  EventClient,
  MerchantClient,
  // APNSService,
  mailer,
  publishSMS
} = require('aws-layer')
const {
  customerReceipt,
  newLoanConfirmationCustomer,
  reminder1,
  merchantReceipt,
  onPurchaseToMerchant,
  overduePaymentFirst,
  overduePaymentLate
} = require('messages')
const { GBP } = require('models')

class Notifications {
  static async handlePaymentFailure (phone, repayment, overdueFees) {
    if (phone) await publishSMS(
        `+${phone}`, 
        overdueFees ? overduePaymentLate(GBP.toPounds(repayment + overdueFees)) : overduePaymentFirst(GBP.toPounds(repayment), 5)
      )
  }

  static async sendNewLoanConfirmations (loanState) {
    const { userName, items, customItems, total: totalAmount, referenceCode } = loanState
    const userTable = new UserClient(userName)
    const { email, emailConfirmed, name } = await userTable.details()
    const poundAmount = GBP.toPounds(totalAmount);

    const currentTransaction = latestPaidTransaction(loanState.transactions)
    const repayment = currentTransaction.amount
    const paymentTimestamp = Math.round(currentTransaction.timestamp / 1000)

    const { pollenReference, paymentMethod } = loanState

    let merchant
    if (loanState.otherMerchant) {
      merchant = loanState.otherMerchant
    } else {
      merchant = loanState.merchantID
      const merchantTable = new MerchantClient(merchant)
      let { Items: merchantDetails } = await merchantTable.query()
      merchantDetails = merchantDetails[0]
      merchant = merchantDetails.merchantName
      let phone;
      if (!!merchantDetails.contactDetails) {
        phone = merchantDetails.contactDetails.phone;
      }
      let { Items: merchantUser } = await merchantTable.query('user')
      merchantUser = merchantUser[0]
      const { email, billing } = merchantUser
      // if a direct merchant we also want to send them a confirmation
      const fees = (billing && billing.commission) ? totalAmount * billing.commission : 0
      const amountToMerchant = totalAmount - fees
      const fullName = formFullName(name)
      const itemsDescription = await formItems(loanState.merchantID, items, customItems)
      const { subject, mailbody } = merchantReceipt(
        fullName,
        paymentTimestamp,
        itemsDescription,
        pollenReference,
        poundAmount,
        referenceCode,
        fees,
        amountToMerchant
      )
      await mailer(
        [email],
        subject,
        mailbody
      )
      
      // send SMS notification to the direct merchant
      if (phone) await publishSMS(`${phone}`, onPurchaseToMerchant(referenceCode, poundAmount));
    }

    // send receipt to the merchant but not to the user if email not confirmed
    if (!emailConfirmed) {
      return 0
    }

    let paymentMethodType; let paymentMethodNumber
    const { Items: paymentMethodDetails, Count: pmCount } = await userTable.queryStrict(`paymentMethod-${paymentMethod}`)
    if (!pmCount) { paymentMethodType = ''; paymentMethodNumber = '' } else {
      paymentMethodNumber = paymentMethodDetails[0].digits
      paymentMethodType = paymentMethodDetails[0].type
      switch (paymentMethodType) {
        case 'visa': paymentMethodType = 'Visa'; break
        case 'mastercard': paymentMethodType = 'Mastercard'; break
        case 'amex': paymentMethodType = 'AmEx'; break
        default: paymentMethodType = 'Card'
      }
    }

    const { subject, mailbody } = newLoanConfirmationCustomer(
      merchant,
      repayment,
      paymentMethodType,
      paymentTimestamp,
      paymentMethodNumber,
      pollenReference
    )
    await mailer(
      [email],
      subject,
      mailbody
    )
  }

  static async sendReceipt (loanState, fromAutomatedRepayment) {
    console.log(loanState)
    fromAutomatedRepayment = false // temp workaround
    if (fromAutomatedRepayment) {
      let timestamp = Number(new Date(`${new Date().toISOString().split('T')[0]}T08:00:00.000Z`))
      if (timestamp < Date.now()) {
        timestamp += 24 * 60 * 60 * 100
      }
      timestamp = Math.round(timestamp / 1000)
      await EventClient.putEvent(
        `${Number(loanState.userName)}-${loanState.fullID}`,
        timestamp,
        'sendReceipt'
      )
    } else {
      const { userName } = loanState
      const userTable = new UserClient(userName)
      const { name, email, emailConfirmed } = await userTable.details()
      if (!emailConfirmed) {
        await Notifications.sendReceipt(loanState, true)
      }
      const fullName = formFullName(name)

      let merchant
      if (loanState.otherMerchant) {
        merchant = loanState.otherMerchant
      } else {
        merchant = loanState.merchantID
        const merchantTable = new MerchantClient(merchant)
        let { Items: merchantDetails } = await merchantTable.query()
        merchantDetails = merchantDetails[0]
        merchant = merchantDetails.merchantName
      }

      const currentTransaction = latestPaidTransaction(loanState.transactions)
      const repayment = currentTransaction.amount
      const paymentTimestamp = Math.round(currentTransaction.timestamp / 1000)

      const { balance, pollenReference, paymentMethod } = loanState

      let paymentMethodType; let paymentMethodNumber
      const { Items: paymentMethodDetails, Count: pmCount } = await userTable.queryStrict(`paymentMethod-${paymentMethod}`)
      if (!pmCount) { paymentMethodType = ''; paymentMethodNumber = '' } else {
        paymentMethodNumber = paymentMethodDetails[0].digits
        paymentMethodType = paymentMethodDetails[0].type
        switch (paymentMethodType) {
          case 'visa': paymentMethodType = 'Visa'; break
          case 'mastercard': paymentMethodType = 'Mastercard'; break
          case 'amex': paymentMethodType = 'AmEx'; break
          default: paymentMethodType = 'Card'
        }
      }

      const { subject, mailbody } = customerReceipt(
        fullName,
        merchant,
        repayment,
        paymentMethodType,
        paymentMethodNumber,
        pollenReference,
        balance,
        paymentTimestamp
      )

      await mailer(
        [email],
        subject,
        mailbody
      )
    }
  }

  static async sendReminder1 (loanState) {
    const { daysLeft } = require('./helpers')
    const { userName } = loanState
    const userTable = new UserClient(userName)
    const { name, email, emailConfirmed } = await userTable.details()
    if (!emailConfirmed) {
      return 0
    }
    const fullName = formFullName(name)

    let merchant
    if (loanState.otherMerchant) {
      merchant = loanState.otherMerchant
    } else {
      merchant = loanState.merchantID
      const merchantTable = new MerchantClient(merchant)
      let { Items: merchantDetails } = await merchantTable.query()
      merchantDetails = merchantDetails[0]
      merchant = merchantDetails.merchantName
    }

    const currentTransaction = latestPaidTransaction(loanState.transactions)
    const repayment = currentTransaction.amount
    const paymentTimestamp = Math.round(currentTransaction.timestamp / 1000)

    const { pollenReference, paymentMethod, total } = loanState

    let paymentMethodType; let paymentMethodNumber
    const { Items: paymentMethodDetails, Count: pmCount } = await userTable.queryStrict(`paymentMethod-${paymentMethod}`)
    if (!pmCount) { paymentMethodType = ''; paymentMethodNumber = '' } else {
      paymentMethodNumber = paymentMethodDetails[0].digits
      paymentMethodType = paymentMethodDetails[0].type
      switch (paymentMethodType) {
        case 'visa': paymentMethodType = 'Visa'; break
        case 'mastercard': paymentMethodType = 'Mastercard'; break
        case 'amex': paymentMethodType = 'AmEx'; break
        default: paymentMethodType = 'Card'
      }
    }

    const dueIn = daysLeft(paymentTimestamp, true).split('(')[1].split(')')[0]

    const { subject, mailbody } = reminder1(
      fullName,
      merchant,
      repayment,
      paymentMethodType,
      paymentMethodNumber,
      pollenReference,
      total,
      paymentTimestamp,
      dueIn
    )
    await mailer(
      [email],
      subject,
      mailbody
    )
  }
}
exports.Notifications = Notifications

const formFullName = (nameObject) => {
  let name = nameObject.givenName
  if ('surname' in nameObject) {
    name += ` ${nameObject.surname}`
  }
  return name
}

const latestPaidTransaction = (transactions) => {
  transactions.sort((a, b) => (a.timestamp - b.timestamp))
  const paidTransactions = transactions.filter(item => item.status === 'paid')
  return paidTransactions.pop()
}

const formItems = async (merchantID, items, customItems) => {
  let itemsDescription = ''
  if (items) {
    const merchantTable = new MerchantClient(merchantID)
    for (let i = 0; i < items.length; i++) {
      const productID = items[i]
      const product = await merchantTable.query(`product-${productID}`)
      if (!product.Count) { continue }
      const { name, totalPrice } = product.Items[0]
      itemsDescription += `${name} (GBP ${GBP.toPounds(totalPrice)}); `
    }
  }
  if (!!customItems && customItems.length > 0) {
    for (const item of customItems) {
      const { name, price, qty } = item
      itemsDescription += name
      if (qty > 1) { itemsDescription += `x${qty}` }
      itemsDescription += `(GBP ${price}); `
    }
  }
  itemsDescription = itemsDescription.slice(0, -2)
  return itemsDescription
}
