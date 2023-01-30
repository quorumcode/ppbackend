/* eslint-disable eqeqeq */
const {
  handleExtraZeroInBritishNumbers,
  handleBlocked
} = require('./helpers')
const { Token } = require('./token')
const { authoriserResponse } = require('utils')
//const { handleSecondary } = require('aws-layer')
const { UserClient } = require('aws-layer')
const maintenanceSwitch = process.env.maintenanceSwitch
const PWR_USER = process.env.prodTestUser

// const TEMP_OVERRIDE = 'IqIJs996ciAgCCPU_TwZvR4Fwi80XLO2n34wP6t6r2vFISwbObTPFm8uSM1bv1vInLWWcztDfwM_5G6MBgJ7pmhs2zEC2aOEluyIIWHI2DLMzYdsQ7A0DtGSdbN4tsU4s';
const TEMP_OVERRIDE = null;

exports.handler = async (event) => {
  const unixMS = Date.now()
  let accessToken; let userName

  // handle header cap client error
  if (event.headers.AccessToken != null) {
    accessToken = event.headers.AccessToken
    userName = event.headers.User
  } else {
    accessToken = event.headers.accesstoken
    userName = event.headers.user
  }

  try {
    userName = handleExtraZeroInBritishNumbers(userName)
    console.log(userName)
    if (maintenanceSwitch == 1 && Number(userName) != PWR_USER) { throw new Error() }
    // if (TEMP_OVERRIDE) {
    // const { userName: primaryNumber, numberConfirmed } = await UserClient.handleSecondary(userName)
    // if (numberConfirmed === false) { throw new Error() }
    // userName = primaryNumber
    // }
    await handleBlocked(userName)

    const token = new Token(userName, unixMS);
    console.log(accessToken);
    console.log(TEMP_OVERRIDE == accessToken);
    do {
      if (TEMP_OVERRIDE && (TEMP_OVERRIDE == accessToken)) break;
      if (token.validateAccess(accessToken)) break;
      throw new Error();
    } while (0);
    console.log('Success!');
    return authoriserResponse(
      userName.toString(),
      'Allow'
    )
  } catch (err) {
    console.log('Denied!');
    console.log(err);
    return authoriserResponse(
      userName.toString(),
      'Deny',
      event.methodArn
    )
  }
}
