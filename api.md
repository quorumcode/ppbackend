# API by use cases

## User sign up flow
    post /register: request an SMS and session token for login/signup (PPApi+Register.swift)
    post /resendconfirmation: resend SMS with code (PPApi+ResendConfirmation.swift)
    post /verify: validate SMS code and get accessToken (PPApi+Verify.swift)
    post /checkemail: checks if email already registered (PPApi+CheckEmail.swift)
    post /refreshtoken: refreshes the access token (PPApi+RefreshToken.swift)

## Document upload
    get /getuser: documentsSubmitted property of the user object resposne determines if they passed ID check (PPApi+GetUser.swift)
    get /wallet/checkkyc: detrmines if user passed proof of address check (PPApi+CheckKYC.swift)
    get /getkycresource: submits verification ID of ID/address verification to the DB; if ID/passport then returns name object and date of birth (PPApi+GetKYCResource.swift)

## Payments method management
    get /cards: returns list of payments methods added to stripe (PPApi+Card.swift)
    get /newseti: request a clientSecret from stripe for adding new cards through Stripe SDK on the client
    post /cards: adds stripe payment ID to the DB (PPApi+Card.swift)
    put /cards: for setting a card as primary (PPApi+Card.swift)
    delete /cards: removes a card

## User settings update
    post /updateuser: updating user sex, address, deleting profile image, notification settings, marketing settings (PPApi+DeleteProfileImage.swift, PPApi+UpdateUser.swift)
    post /uploadprofileimage: uploads a base64 encoded image (PPApi+UploadImage.swift)

## Recovery:
    (doesn't work right now) post /updaterecovery: request an SMS to verify a new recovery number (PPApi+UpdateRecovery.swift)
    (doesn't work now) post /verifyrecovery: valdiates SMS code and creates a new recovery number (PPApi+VerifyRecovery.swift)
    (doesn't work right now) delete /updaterecovery: removes a recovery number (PPApi+UpdateRecovery.swift)

## Merchants:
    get /getmerchants: legacy method that returns a full list of merchants grouped by categories (PPApi+GetMerchants.swift)
    get /merchants: returns all merchants (for the web app)
    get /categories: returns merchants by category (for the web app)
    get /listcategories: returns list of categories (for the web app)
    get /categories/{category}: returns a list of merchants by category with locations (for the web app)

## New loan flow
    get /getparams: returns purchase limits and server time (PPApi+GetParams.swift)
    get /checkloancap: checks if user can create new loans (PPApi+CheckLoans.swift)
    post /getrepaymentscheme: determines the repayment amounts given the total requested (PPApi+PaymentScheme.swift)
    post /postloan: creates a new loan for direct merchants (PPApi+PostLoan.swift)

## Purchase management
    post /getpurchases: returns a list of all purhcases or a list of all unpaid purchases (PPApi+GetPurchases.swift)
    post /earlyrepay: repays any amount to a loan (PPApi+EarlyRepay.swift)
    post /getloan: fetch a loan by ID (PPApi+GetLoan.swift)

## Wallet (Virtual cards)
    post /joinwaitlist: marks that user wants to have a card (PPApi+JoinWaitList.swift)
    (Only works on production) post /wallet/activate: generates a virtual mastercard (removed from iOS for now)
    (Only works on production) get /wallet: returns virtual card details (PPApi+Wallet.swift)
    (Only works on production) post /wallet/unlock: loads the vritual card with moneys and shares card detail (PPApi+Unlock.swift)
    post /webhook: for processing Lerex notifications on new transactions and verification SMS (not accessible from iOS obvs)

## Apple Push:
post /postpushtoken: posts device ID and device token (PPApi+PushToken.swift)


