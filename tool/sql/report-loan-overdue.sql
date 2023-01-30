-- Klarna Reference    Date issued    Last payment date    Last payment amount    Balance    Retailer name    Goods Purchased    Forename    Surname    DOB    Email    Country    Tel no 1    Tel no 2    1st line address    2nd line address    Town    Postcode
-- 12345678    21/8/2021    18/9/2021    14.48    43.47    Select Fashion    Tracksuit £50    Katie    Armstrong    9/1/1988    katiearm30@gmail.com    United Kingdom    7496300537        FLAT 22 MARGARET HOUSE    MARGARET STREET    ASHTON-UNDER-LYNE    OL6 7TH

-- POLLENPAY Reference         12345678
-- Date issued                 21/8/2021
-- Last payment date           18/9/2021
-- Last payment amount         14.48
-- Balance                     43.47                       ОСТАТОК, КОТОРЫЙ НАДО ЗАКРЫТЬ
-- Retailer name               Select Fashion
-- Goods Purchased             Tracksuit £50
-- Forename                    Katie
-- Surname                     Armstrong
-- DOB                         9/1/1988
-- Email                       katiearm30@gmail.com
-- Country                     United Kingdom              =====
-- Tel no 1                    7496300537                  =====
-- Tel no 2                                                =====
-- 1st line address            FLAT 22 MARGARET HOUSE
-- 2nd line address            MARGARET STREET
-- Town                        ASHTON-UNDER-LYNE
-- Postcode                    OL6 7TH


/*
samples (some of):
    fully paid in 1 transaction:
        1. легальный кейс когда ты покупаешь с вирт карты лерекса (оно же выплата долга по вирт карте)
        2. когда только-только на релизе была проблема с оплатой мерчанта на лерексt; мерчанту оплатилось, а первый платёж страйп взять не смог, т.е. "бесплатный кредит"; закрыли так: весь кредит реструктурировали в один платёж и закрыли его за раз
        3. поведение карт: когда я плачу лерексовской карты, мы не контроллируем, а получаем хук что произошла покупка, повторная попытка снять на два дня позже, решалось через саппорт (реструктурируется в один)
        4. пришёл в магаз, "я хочу платить через полленпэй", мерчант всё делает, а потом выясняется что юзер не верифицирован, так что саппорт создаёт лоан с планом из одного платежа
        1648423942163-3ASWcRut0QizplUTKedR_
        1647012029411-JM-PyEnVG1k48nU_xPXzk
        1647012790752-eYoT6uW7AWI8jrqZSyuIl
        1647078704901-M-ES9a14gd3bUWU9VZyd4
    fully paid in 2 transactions:
        1647007077645-GDLyzuukXlcQUTXebHm6d
        1647007095344-KxiqzS1wqG80OrW_ZZcpR
        1647007540467-KbhZmz_aVulcB5eZpRkBy
        1647007555431--UdaneYuABp21MrxFID2I
        1647007679167-b2_Rq1c5jAIJobxmTU5ha
    fully paid in 3 transactions:
        1647115934999-P6_IiRt6IWaZ5GnphRntc
        1647146000133-JaEs1yV2_RCDhHlLXG-Zn
        1647172237154-E9KPVW0PEdv_QDp9eywgH
        1647186950010--9Zl2KIpj5uL6v8hLL12G
    fully paid in 4 transactions:
        1647069133814-31jCe3iJaL8VWKVvdDz4M
        1647076018320-_jJ0rkKCcu1XNbyxwH6XY
        1647078500247-c31pfLna2Q-C2WJOdFiMU
        1647083630809-VpkjzodMAeLTWncaH7ZfC
    fully paid in 5 transactions:
        1646820213958--tzocHwQ0tK1ZZUo9hfOL
        1646929809132-WPLS65vzPPBCdHWFq2M3E
        1647082241973-KpRldt8SQkE-UTUsocnvI
    fully paid in 6 transactions:
        1648747310034-NnOCizwNl0NogqJ6GZ56Z
    fully paid in 7 transactions:
        1646385749071-4di_le05qyt-YWaKgVd_z
    fully paid in 8 transactions:
        (none)
    fully paid in 9 transactions:
        1647065705472-XYMpFpXqLCjgLbIuoAV2T

    partially paid:
        1647135102322-yc8G6rQ3ezNs2Subsaysv | 4 | paid,paid,scheduled,scheduled
        1647162487419-We9YLFyeizFGQEL3osJE9 | 4 | paid,paid,scheduled,scheduled
        1647287672178-jt4EX8AAe4H4qrZZHbgee | 4 | paid,paid,scheduled,scheduled
        1647292071134-g7cHpAp3hJQWh2OMz9tOx | 4 | paid,paid,scheduled,scheduled
        1647358039214-n-o6OQdr-K4uuz827WlDi | 4 | paid,paid,scheduled,scheduled

    strange things:
        loans with "paid" tx AFTER "scheduled":
            select loanStateID, count(*) as c, group_concat(status order by timestamp) as s from loan_trx where archived is null and amount >= 0 group by loanStateID having s like '%scheduled,paid%' order by c;


*/



CREATE OR REPLACE VIEW `report_2dmj4ab_overdue` AS
WITH
    -- a "fixed" version of "global" `loan_trx` utility view to be used in here further, with the following additions/modifications:
    --  filtered not to include merchant payment from us (the one with negative amount / txID ending with '-0')
    --  add _n to be used in initial schedule extraction and payment ordering
    --  add _dt which is `timestamp` typecasted to DATE (this is expected to be the same as it txID, which is "user-fullID-timestamp")
    --  !!! add _sum_base_pre which is accumulated `amount` of all transactions (paid, scheduled, ...) ordered by timestamp, EXCLUDING current amount
    --  !!! add _sum_base_cur which is accumulated `amount` of all transactions (paid, scheduled, ...) ordered by timestamp, INCLUDING current amount
    --  !!! add _sum_base_nxt which is accumulated `amount` of all transactions (paid, scheduled, ...) ordered by timestamp, INCLUDING current AND NEXT amount
    --  add _sum_paid which is accumulated `amount` of transactions with "paid" status ordered by timestamp, INCLUDING current amount
    `loan_trx` as (
        SELECT
            loan.fullID,
            loan.archived,
            loan.loanStateID,
            ROW_NUMBER() OVER (PARTITION BY loan.loanStateID ORDER BY trx.timestamp) as _n,
            FROM_UNIXTIME(trx.timestamp / 1000) as _dt,
            IFNULL(SUM(trx.amount) OVER (PARTITION BY loan.loanStateID ORDER BY trx.timestamp RANGE BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) as _base_sum_pre,
            SUM(trx.amount) OVER (PARTITION BY loan.loanStateID ORDER BY trx.timestamp RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as _base_sum_cur,
            SUM(trx.amount) OVER (PARTITION BY loan.loanStateID ORDER BY trx.timestamp RANGE BETWEEN UNBOUNDED PRECEDING AND 1 FOLLOWING) as _base_sum_nxt,
            SUM(IF(trx.status IN ("paid", "padi" /* lol fix */), trx.amount, 0)) OVER (PARTITION BY loan.loanStateID ORDER BY trx.timestamp RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as _paid_sum,
            trx.*
        FROM
            loan
            INNER JOIN JSON_TABLE(loan.transactions, '$[*]' COLUMNS(
                `_i`        FOR ORDINALITY,
                `txID`      VARCHAR(64)     path '$.txID',
                `amount`    DECIMAL(15, 4)  path '$.amount',
                `paymentID` VARCHAR(32)     path '$.paymentID',
                `status`    VARCHAR(32)     path '$.status',
                `timestamp` DECIMAL(20, 3)  path '$.timestamp'
            )) as trx
        WHERE 1
            AND trx.txID not like '%-0'
    ),

    -- a table representing FIRST loan entry across all with same fullID (the one with min archived OR archived IS NULL)
    `loan_base` as (
        SELECT DISTINCT
            fullID,
            FIRST_VALUE(loanStateID) OVER (PARTITION BY `fullID` ORDER BY ISNULL(archived), archived) as `loanStateID`
        FROM
            `loan`
        WHERE 1
            AND (!loan.deleted OR loan.deleted IS NULL)
    ),

    -- a table representing schedule dates and expected accumulation to that dates from FIRST (or the only) ever created loan entry + an entry to "aggregate" overdues
    `loan_base_trx` as (
        SELECT
            loan_base.fullID,
            loan_base.loanStateID,
            loan_trx._n         as base_n,
            loan_trx._dt        as base_dt,
            loan_trx.amount     as base_amount,
            loan_trx._base_sum_pre  as base_sum_pre,
            loan_trx._base_sum_cur  as base_sum_cur,
            loan_trx._base_sum_nxt  as base_sum_nxt
        FROM
            loan_base
            LEFT JOIN loan_trx ON loan_trx.loanStateID = loan_base.loanStateID
    ),

    -- a table representing CURRENT loan entry across all with same fullID (the one with `archived` IS NULL)
    `loan_paid` as (
        SELECT
            fullID,
            `loanStateID`
        FROM
            `loan`
        WHERE 1
            AND (!loan.deleted OR loan.deleted IS NULL)
            AND `archived` IS NULL
    ),

    -- a table representing CURRENT loan entry (the one where PAID transactions are searched)
    `loan_paid_trx` as (
        SELECT
            loan_paid.fullID,
            loan_paid.loanStateID,
            loan_trx._n         as paid_n,
            loan_trx._dt        as paid_dt,
            loan_trx.amount     as paid_amount,
            loan_trx._paid_sum  as paid_sum
        FROM
            loan_paid
            LEFT JOIN loan_trx ON loan_trx.loanStateID = loan_paid.loanStateID
    ),

    -- a table to represent loan_base_trx and loan_paid_trx side by side, having rows adjusted using timestamps
    `loan_diff_trx` as (
        WITH
            loan_diff_trx_all as (
                SELECT
                    base.fullID,
                    base.loanStateID as base_loanStateID,
                    fill.loanStateID as fill_loanStateID,
                    -- paid.loanStateID as paid_loanStateID,

                    base_n,
                    base_dt,
                    base_amount,
                    base_sum_pre,
                    base_sum_cur,
                    -- base_sum_nxt,

                    ROW_NUMBER() OVER (PARTITION BY base.fullID, base_n ORDER BY paid_n DESC) as upto_n, -- the one with paid_n_fill = 1 is the first payment that closes the payment due for this scheduled trx
                    paid_n,
                    paid_dt,
                    paid_amount,
                    paid_sum
                FROM
                    loan_base_trx as base
                    LEFT JOIN loan_paid_trx as fill ON 1
                        AND fill.fullID = base.fullID
                        AND fill.paid_sum >  base.base_sum_pre
                        AND fill.paid_sum <= base.base_sum_cur
                    -- LEFT JOIN loan_paid_trx as paid ON 1
                    --     AND paid.fullID = base.fullID
                    --     AND paid.paid_sum >= base.base_sum_cur
                -- GROUP BY
                    -- base_loanStateID
                    -- , base_n
                ORDER BY
                    base.fullID, base_n, paid_n
            )
        SELECT
            *
        FROM
            loan_diff_trx_all
        WHERE 1
            AND (upto_n = 1 OR upto_n IS NULL)
    ),

    -- this is kinda pivoted version of loan_diff_trx
    loan_raw as (
        SELECT
            base.fullID as fullID,
         -- base.loanStateID as base_loanStateID,
         -- fill.loanStateID as fill_loanStateID,
            trx1.base_dt        as trx1_base_dt,            -- expected payment date
         -- trx1.base_amount    as trx1_base_amount,        -- expected payment amount for this stage
            trx1.base_sum_cur   as trx1_base_sum,           -- expected accumulated payment since the loan being issued
            trx1.paid_dt        as trx1_paid_dt,            -- actual date of accumulation
            trx1.paid_sum       as trx1_paid_sum,           -- actual funds accumulation
            TIMESTAMPDIFF(DAY, trx1.base_dt, trx1.paid_dt) as trx1_overdue_days,        -- an overdue DAYS for this payment (for trx1 this is always should be 0); negative vaules mean "payment is due OK"

            trx2.base_dt        as trx2_base_dt,
         -- trx2.base_amount    as trx2_base_amount,
            trx2.base_sum_cur   as trx2_base_sum,
            trx2.paid_dt        as trx2_paid_dt,
            trx2.paid_sum       as trx2_paid_sum,
            TIMESTAMPDIFF(DAY, trx2.base_dt, trx2.paid_dt) as trx2_overdue_days,

            trx3.base_dt        as trx3_base_dt,
         -- trx3.base_amount    as trx3_base_amount,
            trx3.base_sum_cur   as trx3_base_sum,
            trx3.paid_dt        as trx3_paid_dt,
            trx3.paid_sum       as trx3_paid_sum,
            TIMESTAMPDIFF(DAY, trx3.base_dt, trx3.paid_dt) as trx3_overdue_days,

            trx4.base_dt        as trx4_base_dt,
         -- trx4.base_amount    as trx4_base_amount,
            trx4.base_sum_cur   as trx4_base_sum,
            trx4.paid_dt        as trx4_paid_dt,
            trx4.paid_sum       as trx4_paid_sum,
            TIMESTAMPDIFF(DAY, trx4.base_dt, trx4.paid_dt) as trx4_overdue_days
        FROM
            loan_base as base
            LEFT JOIN loan_diff_trx as trx1 ON (trx1.fullID, trx1.base_n) = (base.fullID, 1)
            LEFT JOIN loan_diff_trx as trx2 ON (trx2.fullID, trx2.base_n) = (base.fullID, 2)
            LEFT JOIN loan_diff_trx as trx3 ON (trx3.fullID, trx3.base_n) = (base.fullID, 3)
            LEFT JOIN loan_diff_trx as trx4 ON (trx4.fullID, trx4.base_n) = (base.fullID, 4)
         -- LEFT JOIN loan_diff_trx as trxX ON trx0.fullID = base.fullID AND trx0.base_n > 4        -- extra items in initial/base/plan
    ),

    `dummy` as (select null limit 0)

-- DEBUG 1:
-- SELECT
--     loan_diff_trx.*
-- FROM
--     loan_diff_trx
-- WHERE 1
--     AND `fullID` IN (NULL
--         , '1647135102322' /* partially paid in 4: paid, paid, wait, wait */
--         -- , '1646929809132' /* 5 */
--         -- , 1647217615618 /* 6 */
--         -- , 1647065705472 /* 9 */
--     )
-- ORDER BY
--     fullID
--     , base_n
--     , paid_n

-- DEBUG 2:
-- SELECT
--     loan_raw.*
-- FROM
--     loan_raw
-- WHERE 1
--     AND `fullID` IN (NULL
--         , '1647135102322' /* partially paid in 4: paid, paid, wait, wait */
--         -- , '1646929809132' /* 5 */
--         -- , 1647217615618 /* 6 */
--         -- , 1647065705472 /* 9 */
--     )
-- ORDER BY
--     fullID


SELECT
    loan.userID                                         as 'User ID (legacy)'
    , loan.pollenReference                              as 'PollenPay Reference'
    , loan.created                                      as 'Date issued'

    , loan_raw.*
    -- , loan_trx.txID                                     as 'Last payment txID'
    -- , loan_trx.timestamp                                as 'Last payment date (ut_ms)'
    -- , FROM_UNIXTIME(loan_trx.timestamp / 1000)          as 'Last payment date'
    -- , (loan_trx.amount / 100)                           as 'Last payment amount (GBP)'

    , (loan.balance / 100)                              as 'Balance (GBP)'
    , merchant.merchantName                             as 'Merchant name'
    , loan.items                                        as 'Purchased items'
    , loan.customItems                                  as 'Purchased items (custom)'
    , user.nickname                                     as 'User nickname'
    , IFNULL(JSON_VALUE(user.name, "$.givenName"), "")  as 'User given name'
    , IFNULL(JSON_VALUE(user.name, "$.middleName"), "") as 'User middle name'
    , IFNULL(JSON_VALUE(user.name, "$.surname"), "")    as 'User surname'
    , user.dob                                          as 'User DOB'
    , user.email                                        as 'User Email'
    , "--"                                              as 'User Country'
    , user.primaryNumber                                as 'User Tel no 1'
    , user.recoveryNumber                               as 'User Tel no 2'

    -- ["postal_code", "administrative_division", "locality", "route", "street_number"]
    , JSON_VALUE(user.address, "$.postal_code") as user_address_postal_code
    , JSON_VALUE(user.address, "$.administrative_division") as user_address_ad
    , JSON_VALUE(user.address, "$.locality") as user_address_locality
    , JSON_VALUE(user.address, "$.route") as user_address_route
    , JSON_VALUE(user.address, "$.street_number") as user_address_sn
    -- , user.address                                      as 'User address'
    -- , null                                              as '1st line address'
    -- , null                                              as '2nd line address'
    -- , null                                              as 'Town'
    -- , null                                              as 'Postcode'
FROM
    loan_raw
    LEFT JOIN loan on loan.fullID = loan_raw.fullID AND loan.archived IS NULL
    LEFT JOIN merchant ON merchant.merchant = loan.merchantID
    LEFT JOIN user_generic as user ON user.user = loan.userID
WHERE 1
    -- AND loan_trx.txID IS NOT NULL
    AND loan.balance != 0
    AND (!loan.deleted OR loan.deleted IS NULL)
--     AND loan.`fullID` IN (NULL
--         , '1647135102322' /* partially paid in 4: paid, paid, wait, wait */
--         -- , '1646929809132' /* 5 */
--         -- , 1647217615618 /* 6 */
--         -- , 1647065705472 /* 9 */
--     )
ORDER BY
    loan.userID, loan.created

;

/*


    `loan_trx_last` as (
        SELECT
            `loanStateID`,
            -- LAST_VALUE(`txID`) OVER (PARTITION BY `loanStateID` ORDER BY timestamp) as `txID`
            MAX(`timestamp`) as `timestamp`
        FROM
            `loan_trx`
        WHERE 1
            AND `archived` IS NULL
            AND `status` = 'paid'
            AND `txID` not like '%-0'
        GROUP BY `fullID`, `loanStateID`
    )
SELECT
    loan.userID                                         as 'User ID (legacy)'
    , loan.pollenReference                              as 'PollenPay Reference'
    , loan.created                                      as 'Date issued'

    ,



    , loan_trx.txID                                     as 'Last payment txID'
    -- , loan_trx.timestamp                                as 'Last payment date (ut_ms)'
    , FROM_UNIXTIME(loan_trx.timestamp / 1000)          as 'Last payment date'
    , (loan_trx.amount / 100)                           as 'Last payment amount (GBP)'
    , (loan.balance / 100)                              as 'Balance (GBP)'
    , merchant.merchantName                             as 'Merchant name'
    , loan.items                                        as 'Purchased items'
    , loan.customItems                                  as 'Purchased items (custom)'
    , user.nickname                                     as 'User nickname'
    , IFNULL(JSON_VALUE(user.name, "$.givenName"), "")  as 'User given name'
    , IFNULL(JSON_VALUE(user.name, "$.middleName"), "") as 'User middle name'
    , IFNULL(JSON_VALUE(user.name, "$.surname"), "")    as 'User surname'
    , user.dob                                          as 'User DOB'
    , user.email                                        as 'User Email'
    , "--"                                              as 'User Country'
    , user.primaryNumber                                as 'User Tel no 1'
    , user.recoveryNumber                               as 'User Tel no 2'
    , user.address                                      as 'User address'
    -- , null                                              as '1st line address'
    -- , null                                              as '2nd line address'
    -- , null                                              as 'Town'
    -- , null                                              as 'Postcode'
FROM
    loan

    LEFT JOIN loan_trx_last ON loan_trx_last.loanStateID = loan.loanStateID
    LEFT JOIN loan_trx ON loan_trx.loanStateID = loan_trx_last.loanStateID AND loan_trx.timestamp = loan_trx_last.timestamp AND loan_trx.`txID` not like '%-0'
    LEFT JOIN merchant ON merchant.merchant = loan.merchantID
    LEFT JOIN user_generic as user ON user.user = loan.userID
WHERE 1
    AND loan.archived IS NULL
    AND loan_trx.txID IS NOT NULL
    AND loan.balance != 0
    AND (!loan.deleted OR loan.deleted IS NULL)
ORDER BY
    loan.userID, loan.created
;

*/
