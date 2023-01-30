## pre notes:
This rfc explains a methods when a phone number is a login identifier; however the whole schema is
applicable and almost same for the case when there's a "email" instead of "phone".
The design permits quirying history, note that it means "read-only history" and it's strongly
discouraged to introduce any retrospective modifications to the database (however this may be done manually).


## low level fine points (generic to the system):

### "REGISTER USER"
It just means "create a new distinct user_ppid", this either may or may not include adding a login identifier (phone/email/something) to a user record.

### "IDENTIFY USER BY LOGIN ID"
Given some login identifier (phone/email) and point of time there can be only one user with that identifier confirmed, this is guaranteed by design [*].
For a query to be retrospective, "a point of time" may be some timestamp in the past, answering a question "who owned this phone earlier".

### "LET USER IN"
Once user is identified with login id, create a "generic" token which provide an ability to find out a user ppid from it and use it as usual;
that token may be self-contained to securely store user ppid on user side.


## low level fine points for operating entries related to subject of discussion:

### "ADD PHONE", the user is authenticated/authorized to do that (low level)
```
phone may be:
    [A] new to the system
    - or -
    [B] already added by either one or more than one persons
        - and either -
        [B1] is not confirmed by any of them
        or [B2] confirmed by one (and only one!) person
also, the phone being added may already belong to the target user, in this case:
    [C1] if a phone is not confirmed BY HIMSELF, a new row is created, a current one is patched for dt_end to be now(); this is covered just like it is for a [B*] cases
    [C2] if a phone is confirmed BY HIMSELF, an operation does nothing but maybe emitting a "notice" that "this phone is already confirmed by you, nothing to do"
        minor drawback is that such an event is not stored in the database, but this seems OK if it is to be just logged somewhere else (in general system logs e.g.)

having a phone "added" to the user, the system sends OTP to that number
discussion-worthly:
    a throttle logic to restrict user adding more than (e.g.) 5 phones in a day
```

### "CONFIRM PHONE", the user is authenticated/authorized to do that (low level)
```
    [!] CURRENTLY, for sake of security, if a phone is already confirmed (not just added) by another user, an operation explicitly fails with "please contact support" error.
    all rows for other users with this phone being added are updated with dt_end = now;
    much like for the "add phone" logic, the following is done:
    a system inserts a row with dt_beg = now() and confirmed = 1, ignoring failure on unique constraint violation (ensure "row existance"),
    and consequently does "update for portion", so the system do have a knowledge about consequent "confirmation" events (as well as consequent "add" events)

    Some nuance there is. What to do if a phone being confirmed is the only one for some other account? Is it ok to just "steal" that?
```

### "UNLINK PHONE", the user is authenticated/authorized to do that (low level)
```
depending on a phone state relative to target user:
    phone is not added by the user -> an operation by its definition is fundamentally impossible; from user side this is "operation successful", but this event should be logged by general application logging facility (outside database)
    phone is added, but not confirmed -> set dt_end to now(), nothing more to do here
    phone is confirmed, but this is the only confirmed phone for target user -> operation explicitly fails
    phone is confirmed, and is not the only confirmed phone for target user -> set dt_end to now(), nothing more to do here
```

### "EDIT PHONE", the user is authenticated/authorized to do that (low level)
```
this is a kinda special case; behavior depends on a phone state relative to target user (suddenly!):
    old phone is not added by the user -> an operation by its definition is fundamentally impossible, because it is a "user adds phone" case
    old phone is added, but not confirmed -> just like a "unlink old and add new" (transactional)
    old phone is confirmed -> this is the same as "user adds phone" case, because "old" (confirmed) phone must not have been deleted like for "phone is added, but not confirmed" case discussed earlier
```


## high-level apis:

### "LOGREG ONE-STAGED" (authentication with optional user creation first; submit both login id and _stored_ password in single request)
This is mainly applicable to "email" case, however "phone" as login id is also possible; cases breakdown are based on "email" term.
```
- user is found by a email, there can be only one row when an email is confirmed (this is guaranteed by design)
[A] email confirmed, correct pass -> let user in
[B] email confirmed, wrong pass -> error "wrong password"
- the following cases logic should be treated like two-staged login-register:
[C] email added, but not confirmed (password correctness should not be checked)
    -> "you should follow a link we emailed to you to continue" (ui should include a "send again"-like button)
[D] email does not exist nor added
    -> create new user, save password, add (unconfirmed) email, send verification link, show message like in [C]
```

### "LOGREG TWO-STAGED" (authentication with optional user creation first; submit login id with 1st request and _one-time_ password with 2nd request)
```
1st request ("submit a phone") accepts phone and without any db lookup (basic validity check and/or normalisation, e.g. regexp still to be applied) does following:
    -> create a "login" token with a phone number stored, and send it to user (no user_phone insertions should happen here, nor a new user creation)
    -> send OTP password to submitted phone (or send a letter to submitted email for a "email" process)
2nd request ("submit OTP") accepts a token created earlier and OTP; cases:
    wrong OTP -> error
    with correct OTP a user is found by a phone extracted from token, there can be only one row when an phone is confirmed, this is guaranteed by design [*].
    user does exist -> let user in
    user does not exist -> walk through "user confirms phone" process, then let user in
```

## end notes:
```
    [*] There is a case discussed with Anna when for the system to work correctly it is legit to have MORE than one user owning same login ids.
    So it's "an account split" story.
    Alice and Bob have no accounts. Bob creates account for Alice (let the user_ppid for this account be "AAA" for referencing further)
    and puts not only her phone there, but his own too (for any reason, maybe Alice is a Bob's grandma and he want to help her).
    So the account AAA has both Alice's and Bob's phones confirmed, this means either of Alice and Bob may use their own distinct phone numbers
    to log in into same account AAA.
    Then Bob realises PollenPay is a good thing and decides to create his own account. Due to the nature of "logreg" process it's impossible
    (he will just be authenticated as a user of account AAA) until his phone is unlinked from account AAA. This can be covered without introducing
    "multiple users @ same number" the by providing a user who enters correct OTP for submitted phone a couple of options:
    to "sign in to existing account" (following regilar logic) and "sign up with new account" (leading to phone being unlinked from that account).
    The latter option may ever appear if (and only if) that existing account have another phone confirmed. Also it worth mentioning that things may become
    more clear having "sign in" separated from "sign up". And also this may be not a part of "logreg" process, but an option in user settings or even just
    an admin panel functionality.
    With "multiple users @ same number" once user enters correct OTP we may provide him with an option, which target account to choose.

    Although there's also "an account merge" story, it's not related to this document and generally have more obvious use case so won't be discussed here.
```
