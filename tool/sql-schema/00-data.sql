
-- CREATE DATABASE IF NOT EXISTS `v201-debug-test` DEFAULT CHARACTER SET utf8mb4; USE `v201-debug-test`;

-- user_status, user_customer, user_primary, user_recovery, user_details, user_settings
CREATE TABLE IF NOT EXISTS `user_generic`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_origs`                    varchar(64)     GENERATED ALWAYS AS (concat_ws(",", concat_ws(_orig_status, "status"), concat_ws(_orig_customer, "customer"), concat_ws(_orig_primary, "primary"), concat_ws(_orig_primary, "recovery"), concat_ws(_orig_settings, "settings"), concat_ws(_orig_details, "details"))) INVISIBLE,
        `_orig_status`              JSON            DEFAULT NULL INVISIBLE,
        `_rest_status`              JSON            DEFAULT NULL,
        `_orig_customer`            JSON            DEFAULT NULL INVISIBLE,
        `_rest_customer`            JSON            DEFAULT NULL,
        `_orig_primary`             JSON            DEFAULT NULL INVISIBLE,
        `_rest_primary`             JSON            DEFAULT NULL,
        `_orig_recovery`            JSON            DEFAULT NULL INVISIBLE,
        `_rest_recovery`            JSON            DEFAULT NULL,
        `_orig_settings`            JSON            DEFAULT NULL INVISIBLE,
        `_rest_settings`            JSON            DEFAULT NULL,
        `_orig_details`             JSON            DEFAULT NULL INVISIBLE,
        `_rest_details`             JSON            DEFAULT NULL,
        `user`                      BIGINT UNSIGNED NOT NULL,               # 44987654321                                           # ИД ЮЗЕРА В ПОЛЛЕНЕ
        `created`                   DATETIME(3)     DEFAULT NULL,           # 1639171768                                            # дата создания юзера В СЕКУНДАХ                            status
        `deleted`                   BOOL            NOT NULL DEFAULT FALSE, # false,                                                # удалён                                                    status
        `blocked`                   BOOL            NOT NULL DEFAULT FALSE, # false,                                                # заблокирован                                              status
        `softlocked`                BOOL            NOT NULL DEFAULT FALSE, # false                                                 # не можешь покупать, но платить пока можешь                status
        `stripeID`                  varchar(48)     DEFAULT NULL,           # 'cus_KkhNlVNIGKymF7',                                 # ид юзера в страйпе                                        customer
        `lerexID`                   varchar(48)     DEFAULT NULL,           # 'bcc53ad8-ce7c-4dec-9e84-9fe3632e8b49',               # ид юзера в лерексе                                        customer
        `primaryPaymentMethod`      varchar(48)     DEFAULT NULL,           # 'pm_1K1qumLf6bScP1MibS4qW9Wk'                         # ИД способа автоплатежа (как чувак возвращает бабло)       customer
        `primaryStatus`             BOOL            DEFAULT FALSE,          # false                                                 # подтверждён ли телефон                                    primary
        `primaryNumber`             varchar(24)     DEFAULT NULL,           # '+44987654321'                                        # телефон                                                   primary
        `recoveryStatus`            BOOL            DEFAULT FALSE,          # false                                                 # подтверждён ли телефон для восстановления                 recovery
        `recoveryNumber`            varchar(24)     DEFAULT NULL,           # '+44987654321'                                        # телефон для восстановления                                recovery
        `primaryStatus2`          BOOL            DEFAULT FALSE,          # false                                                 # DELETE THIS COLUMN подтверждён ли телефон                 settings      DUP
        `primaryNumber2`          varchar(24)     DEFAULT NULL,           # '+44987654321'                                        # DELETE THIS COLUMN телефон                                settings      DUP
        `marketing`                 JSON            DEFAULT NULL, # '{ push: null, email: null }'                                   # присылать ли рекламу                                      settings
        `notifications`             JSON            DEFAULT NULL, # '{ push: null, email: null }'                                   # настройки уведомлений                                     settings
        `emailConfirmed`            bool            DEFAULT FALSE,          # true                                                  # мыло подтверждено                                         details
        `dob`                       varchar(16)     DEFAULT NULL,           # '1983-12-10',                                         # дата рождения                                             details
        `identityId`                varchar(24)     DEFAULT NULL,           # '61b37ffe2a8575001e54c699',                           # идентификатор загруженного скана документов (idFileLink)  details
        `sex`                       varchar(64)     DEFAULT NULL,           # 'Prefer not to say',                                  # пол, строка                                               details
        `name`                      JSON            DEFAULT NULL, # '{ "middleName": null, "surname": null, "givenName": null }'    # фио                                                       details
        `email`                     varchar(240)    DEFAULT NULL,           # 'asd@asd.com',                                        # мыло юзера                                                details
        `nickname`                  varchar(64)     DEFAULT NULL,           # 'Dumpling',                                           # ник юзера                                                 details
        `address`                   JSON            DEFAULT NULL, # '{ ... }'                                                       # адрес, тот же формат, что и в гугл плейсес                details
        # address.street_number: '12',
        # address.locality: 'Glasgow',
        # address.route: 'High Street',
        # address.administrative_division: 'Glasgow City',
        # address.postal_code: 'G1 1NL'
        `KYCDate`                   DATETIME(3)     DEFAULT NULL,           # 1639171768,                                           # дата закидывания доков в know your customer В СЕКУНДАХ    status
        `lerexKYCSubmitted`         BOOL            DEFAULT NULL,           # true,                                                 # отправлены ли доки юзера в лерекс                         status
        `idFileLink`                varchar(1024)   DEFAULT NULL,           # 'https://user-assets-pp03uat.s3.eu-west-2.amazonaws.com/%2B4987654321-id.jpg',                                    status
        `verificationID`            varchar(24)     DEFAULT NULL,           # '61b37ffe2a8575001e54c699'                            # ид паспорта или доп. документа (addressFileLink)          status
        `addressFileLink`           varchar(1024)   DEFAULT NULL,           # 'https://user-assets-pp03uat.s3.eu-west-2.amazonaws.com/%2B4987654321-poa.jpg'                                    status
        `addressVerificationID`     varchar(24)     DEFAULT NULL,           # '61a5ba30967c8a001c283e1c',                           # ид документа подтверждающего место нахождения юзера       status
        `tmp_addressFileLink`       varchar(1024)   DEFAULT NULL,           # 'https://user-assets-pp03uat.s3.eu-west-2.amazonaws.com/mazGDiXsnHb-Zy14zlgZZ.jpg'                                status
        `tmp_addressVerificationID` varchar(24)     DEFAULT NULL,           # '620fcf07ffcef1001debc757'                                                                                        status

        `IDStatus`                  varchar(48)     DEFAULT NULL,
        `addressStatus`             varchar(48)     DEFAULT NULL,

        UNIQUE KEY (`user`),
        # UNIQUE KEY (`email`),

        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;




CREATE TABLE IF NOT EXISTS `user_wallet`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,
        `user`                      BIGINT UNSIGNED NOT NULL,               # 44987654321                                           # ИД ЮЗЕРА В ПОЛЛЕНЕ
        `limit`                     DECIMAL(15, 4)  DEFAULT NULL,           # '25000',                                              # сколько ещё можно потратить ПЕНСОВ                        wallet
        `individualAllowance`       DECIMAL(15, 4)  DEFAULT NULL,           # '40000',                                              # индивидуальный лимит ПЕНСОВ                               wallet
        `activeCard`                BOOL            DEFAULT NULL,           # true                                                  # есть или нет карта, выпущенная лерексом                   wallet
        `card`                      JSON            DEFAULT NULL, # '{ ... }'                                                       # карта, выпущенная лерексом (может быть только одна)       wallet
        # card.cvc: '488',
        # card.endMonth: 11,
        # card.nameOnCard: 'Emma Anderson',
        # card.endYear: 24,
        # card.cardNumber: '5358120000048861',
        # card.cardID: 1009
        `lockTimestamp`             DATETIME(3)     DEFAULT NULL,           # '2021-12-06T12:50:38.257Z',                           # ISO 8601 дата блокировки (сокрытия) карты                 wallet
        `waitlist`                  BOOL            DEFAULT NULL,           # true                                                  # ожидает ручной модерации для получения карты              wallet

        UNIQUE KEY (`user`),
        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;

-- user_paymentMethod
CREATE TABLE IF NOT EXISTS `user_paymeth`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,
        `user`                      BIGINT UNSIGNED NOT NULL,               # 44987654321                                           # ИД ЮЗЕРА В ПОЛЛЕНЕ
        `pmID`                      varchar(32)     NOT NULL,               # 'pm_1K1qumLf6bScP1MibS4qW9Wk',                        # ИД способа автоплатежа                                    paymentMethod-pm_1K1qumLf6bScP1MibS4qW9Wk
        `addedTimestampS`           DATETIME(3)     DEFAULT NULL,           # 1638357838,                                           # дата создания В СЕКУНДАХ                                  paymentMethod-pm_1K1qumLf6bScP1MibS4qW9Wk
        `type`                      varchar(32)     DEFAULT NULL,           # 'visa',                                               # тип карты                                                 paymentMethod-pm_1K1qumLf6bScP1MibS4qW9Wk
        `digits`                    varchar(8)      DEFAULT NULL,           # '4242',                                               # последние 4 цифры карты                                   paymentMethod-pm_1K1qumLf6bScP1MibS4qW9Wk

        UNIQUE KEY (`user`, `pmID`),
        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;

-- user_apns
CREATE TABLE IF NOT EXISTS `user_device_token`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,
        `user`                      BIGINT UNSIGNED NOT NULL,               # 44987654321                                           # ИД ЮЗЕРА В ПОЛЛЕНЕ
        `device`                    varchar(48)     NOT NULL,               # E658373E-8FC0-41CC-A542-A42D4E5C12BA                  # ид девайса
#       `token`                     JSON            NOT NULL DEFAULT "[]",  # [ 0e7b5e07e3671cb39aef57da3eb3322834c58d86d43a00268017c34c27fb3fec ]  # токены девайса
        `token`                     varchar(64)     NOT NULL,               # 0e7b5e07e3671cb39aef57da3eb3322834c58d86d43a00268017c34c27fb3fec        # токен девайса

        UNIQUE KEY (`user`, `device`),
        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;

-- "мерчант" это типа "продавец", но по схеме это скорее "маркетплейс", ну и собственно а у продавца есть аккаунт для управления маркетплейсом...
CREATE TABLE IF NOT EXISTS `merchant`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,

        `merchant`                  varchar(24)     NOT NULL,               # 'T5kaTT2tem6hFuyQ15bRp'                               # merchant_id
        `parent`                    JSON            DEFAULT NULL,           # null                                                  # нереализованная фича группировка мерчантов                                details
        `deal`                      JSON            DEFAULT NULL,           # true                                                  # детали скидки                                                             details
        `direct`                    JSON            DEFAULT NULL,           # true                                                  # прямой мерчант (юзер в системе) или "закладка левого сайта"               details
        `allowCustomAmounts`        BOOL            DEFAULT NULL,           # true                                                  # может ли покуп ввести сколько он хочет потратить вручную                  details
        `link`                      varchar(1024)   DEFAULT NULL,           # 'https://pollenpay.com'                               # урл магаза                                                                details
        `logoURL`                   varchar(1024)   DEFAULT NULL,           # '???'                                                 # урл лого магаза                                                           details
        `merchantName`              varchar(1024)   DEFAULT NULL,           # 'Demo No-Pricelist Merchant',                         # название магаза                                                           details
        `imageURL`                  varchar(1024)   DEFAULT NULL,           # 'https://i.ebayimg.com/images/g/9AEAAOSwyVRfYb~x/s-l300.jpg'                                                                      details
        `inStore`                   BOOL            DEFAULT NULL,           # true                                                  # тег для клиента -- покупаешь ли ты онлайн или в физ. магазе               details
        `online`                    BOOL            DEFAULT NULL,           # true                                                  # тег для клиента -- покупаешь ли ты онлайн или в физ. магазе               details
        `location`                  JSON            DEFAULT NULL,           # null                                                  # легаси, превратилось в подзаписи location-*                               details
        `category`                  INT UNSIGNED    DEFAULT NULL,           # 0                                                     # главная категория, список категорий -- статический список где-то в слоях  details
        `subcategory`               JSON            DEFAULT NULL,           # [ 'Financial services' ]                              # просто "массив тегов"                                                     details
        `relevanceIndex`            JSON            DEFAULT NULL,           # 2                                                     # (легаси) вес сортировки                                                   details
        `popular`                   JSON            DEFAULT NULL,           # true                                                  # (легаси) наличие в фильтре популярных                                     details
        `contactDetails`            JSON            DEFAULT '{ "phone": null, "email": null }',                                     # только при формировании займов для связи с мерчантом                      details
        `batch`                     JSON            DEFAULT NULL,                                                                   # (пока не легаси) "партия" импорта                                         details
        `hidden`                    BOOL            DEFAULT NULL,                                                                  # (?) скрытый от обычных юзеров мерчант                                     details

        UNIQUE KEY (`merchant`),
        UNIQUE KEY (`merchantName`),
        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;

ALTER TABLE `merchant` ADD `_dt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP() AFTER `merchant`;


-- учётка мерчанта (точнее, юзера-управлятора мерчантом: термины такие термины)
CREATE TABLE IF NOT EXISTS `merchant_user`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,

        `merchant`                  varchar(24)     NOT NULL,               # 'T5kaTT2tem6hFuyQ15bRp'                               # merchant_id
        `email`                     varchar(1024)   DEFAULT NULL,           # 'no-reply@apollenpay.com'                             # логин мерчанта                                                            user
        `hash`                      varchar(1024)   DEFAULT NULL,           # '$2a$10$wKnW....'                                     # хеш от пароля                                                             user
        `settlements`               JSON            DEFAULT NULL,           # []                                                    # плейсхолдер про желаемое поведение при создании займа (???)               user
        # заказано, но не послано мерчанту, крч для группировки платежей
        # settlements[].
        `billing`                   JSON            DEFAULT NULL,           #                                                       # как переводить бабло мерчанту                                             user
        # billing.accountNumber: '20230427',
        # billing.beneficiary: 'PollenPay Uk Ltd',
        # billing.sortCode: '621000'
        # billing.comission: ?                                                                                                      # комиссия мерчанта, в долях от единицы (?)
        `batch`                     JSON            DEFAULT NULL,                                                                   # (пока не легаси) "партия" импорта                                         details

        UNIQUE KEY (`merchant`),
        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;

CREATE OR REPLACE VIEW `merchant_user_billing` as
    SELECT
        mu.merchant,
     -- mu.billing,
        CAST(JSON_VALUE(mu.billing, "$.accountNumber") as VARCHAR(16))              as accountNumber,                               # номер счёта (?)
        CAST(JSON_VALUE(mu.billing, "$.beneficiary") as VARCHAR(128))               as beneficiary,                                 # получатель платежа
        CAST(JSON_VALUE(mu.billing, "$.sortCode") as VARCHAR(16))                   as sortCode,                                    # местный "бик"
        CAST(IFNULL(JSON_VALUE(mu.billing, "$.commission"), 0) as DECIMAL(10, 6))  as commission
    FROM
        merchant_user as mu
;


-- почему бы не сделать просто таблицу адресов -- и для юзеров и для мерчантов? плюсы-минусы, подводные камни?
-- почему для мерчанта адрес строкой и геокоординаты, а для юзера -- гугл плейсес?
CREATE TABLE IF NOT EXISTS `merchant_location`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,

        `merchant`                  varchar(24)     NOT NULL,               # 'T5kaTT2tem6hFuyQ15bRp'                               # merchant_id
        `_record`                   varchar(64)     NOT NULL,               # 'location-1'                                          # поле record из оригинальных данных (пока я не пойму, что с этим делать, см описание к таблице)
        `address`                   varchar(1024)   DEFAULT NULL,           # 'London SW1A 1AA, United Kingdom'                     # адрес магаза строкой (почему-то)                                          location-1
        `lng`                       JSON            DEFAULT NULL,           # -0.14187607778396924                                  # долгота (TODO: POINT)                                                     location-1
        `lat`                       JSON            DEFAULT NULL,           # 51.501415898221474                                    # широта (TODO: POINT)                                                      location-1

        UNIQUE KEY (`merchant`, `_record`),
        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;

-- товары мерчантов
-- ...бывают ли одни и те же товары у разных мерчантов? (привет, алибаба, wb и озон)
CREATE TABLE IF NOT EXISTS `merchant_product`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,

        `merchant`                  varchar(24)     NOT NULL,               # 'T5kaTT2tem6hFuyQ15bRp'                               # merchant_id
        `productID`                 varchar(24)     DEFAULT NULL,           # 'LugiCz2X'                                            # ид товара                                                                 product-LugiCz2X
        `priceSansTax`              DECIMAL(15, 4)  DEFAULT NULL,           # 179000                                                # цена без налога (ПЕНСЫ)                                                   product-LugiCz2X
        `totalPrice`                DECIMAL(15, 4)  DEFAULT NULL,           # 179000                                                # цена с налогом (ПЕНСЫ)                                                    product-LugiCz2X
        `productGroupID`            varchar(24)     DEFAULT NULL,           # 'k7B3ZEVk'                                            # внутренний ид группы товара от мерчанта (на самом деле нет)               product-LugiCz2X
        `name`                      varchar(256)    DEFAULT NULL,           # 'Big item to test instant rejects'                    # имя товара                                                                product-LugiCz2X
        `imageURL`                  varchar(1024)   DEFAULT NULL,           # '...'                                                 # урл картинка товара                                                       product-LugiCz2X
        `index`                     INT UNSIGNED    DEFAULT NULL,           # 0                                                     # индекс сортировки                                                         product-LugiCz2X
        `taxPercent`                DECIMAL(15, 4)  DEFAULT NULL,           # 0                                                     # процент налога                                                            product-LugiCz2X

        UNIQUE KEY (`merchant`, `productID`),
        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;

-- группы (не категории...) товаров мерчантов
CREATE TABLE IF NOT EXISTS `merchant_productgroup` # merchant_productGroup
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,

        `merchant`                  varchar(24)     NOT NULL,               # 'T5kaTT2tem6hFuyQ15bRp'                               # merchant_id                                                               productGroup-gKpIJT4O
        `productGroupID`            varchar(24)     NOT NULL,               # 'gKpIJT4O'                                            # ид группы                                                                 productGroup-gKpIJT4O
        `name`                      varchar(256)    DEFAULT NULL,           # 'Hot-dogs'                                            # название группы                                                           productGroup-gKpIJT4O
        `index`                     INT UNSIGNED    DEFAULT NULL,           # 0                                                     # индекс сортировки                                                         productGroup-gKpIJT4O

        UNIQUE KEY (`merchant`, `productGroupID`),
        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
;



CREATE TABLE IF NOT EXISTS `loan`
    (
        `_pk`                       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        `_orig`                     JSON            DEFAULT NULL INVISIBLE,
        `_rest`                     JSON            DEFAULT NULL,

        `loanStateID`               VARCHAR(48)     DEFAULT NULL,           # '1638698526296-XuVrCKhnQ1IeNG8hkT0b4'                 # ПРАЙМАРИ КЛЮЧ для записей в этой таблице
        `fullID`                    VARCHAR(16)     DEFAULT NULL,           # '1638698526296'                                       # ид записи (может дублироваться среди актуальных и архивных!)
        `created`                   DATETIME(3)     NOT NULL,               # 1638698526296                                         # дата создания (возможно очередного) займа
        `archived`                  DATETIME(3)     DEFAULT NULL,           # 1638698526296                                         # дата превращения текущей записи в "архивную", в легаси базе актуальная запись всегда с archived = 0; в новой базе = NULL
        `deleted`                   BOOL            DEFAULT NULL,           # ???                                                   # ??? видел в живой базе, причём с вариантами "deleted", "Delete" и "Deleted"
        `userID`                    BIGINT UNSIGNED NOT NULL,               # 44987654321                                           # ИД ЮЗЕРА В ПОЛЛЕНЕ

        `transactions`              JSON            NOT NULL DEFAULT "[]",  # [ { ...}, { ... }, ... ]                              # график платежей по кредиту + платежи от нас магазу
        # transactions[].txID: '79529394217-1639849063928-1639850756723',                                                           # user - loan - timestamp (для юзерских платежей)
                                                                                                                                    # user - loan - 0 (для платежа от нас магазу)
        # transactions[].amount: 3219,                                                                                              # ПЕНСЫ; когда платёж от нас -- тут минус
        # transactions[].paymentID: 'pi_3K87I9Lf6bScP1Mi1AIoLMeY',                                                                  # страйповский идентификатор платежа (если это наш платёж -- то тут другой ф-т?)
        # transactions[].status: 'paid',                                                                                            # paid draft scheduled TBA (+ пропущен)
        # transactions[].timestamp: 1639850756723                                                                                   # миллисек
        `total`                     DECIMAL(15, 4)  NOT NULL,               # 17900                                                 # сколько всего занял в ЭТОМ КОНКРЕТНОМ займе
        `overdue`                   BOOL            NOT NULL,               # false                                                 # просрочка (да нет)
        `pollenReference`           VARCHAR(16)     NOT NULL,               # 'KWT-2SJ-88'                                          # fullID, конвертированный в base36 aka id, посылаемый в письме-подтвердении, чтобы саппорт мог найти кейс
        `balance`                   DECIMAL(15, 4)  NOT NULL,               # 0                                                     # сколько ещё человеку осталось ВЕРНУТЬ в ЭТОМ КОНКРЕТНОМ займе
        `merchantID`                VARCHAR(32)     DEFAULT NULL,           # 'T5kaTT2tem6hFuyQ55bRp'                               # ид мерчанта
        `paymentMethod`             VARCHAR(32)     DEFAULT NULL,           # 'pm_1K1aURLf6bScP1MiZsbMFRFh'                         # выбранный метод автовозврата бабла (СТРАЙП)
        `referenceCode`             VARCHAR(16)     DEFAULT NULL, -- CHAR(4)# '9YJ7'                                                # более короткий ид покупки, уникальный среди одного юзера (что говорит юзер, приходя за покупкой)
        # !!! МОЖНО СХЛОПНУТЬ items и customItems
        `items`                     JSON            DEFAULT "[]",           # [ 'SfdycPy6', ... ]                                   # что куплено? (id товаров); каждого товара может быть только 1...
        `customItems`               JSON            DEFAULT "[]",           # [ { ... }, { ... }, ... ]                             # если цена ввелась юзером вручную... короче это список товаров, отсутствующих в базе
        # customItems[].name: 'Custom Amount',
        # customItems[].imageLink: 'https://logo.clearbit.com/https:/pollenpay.com/',
        # customItems[].price: 50,                                                                                                  # единственное (?) место, где это ФУНТЫ, а не ПЕНСЫ!
        # customItems[].qty: 1
        `otherMerchant`             VARCHAR(256)    DEFAULT NULL,           # false или строка, превращаем в null или строку        # если купил через лерексовскую карту, то от лерекса приходит вебхук и там есть название мерчанта и мы формируем otherMerchant из этих данных
        `delayAdvancePayment`       JSON            DEFAULT NULL,           # ???                                                   # ??? видел в живой базе; камент Антона: если ты платишь с карты и у тебя нет денег чтобы покрыть аванс, то мы тебе на два дня даём отсрочку аванса, и если мы её ДАЛИ, то здесь TRUE
        `individualAllowance`       DECIMAL(15, 4)  DEFAULT NULL,           # '40000',                                              # ??? видел в живой базе, как это связано с user_wallet.individualAllowance (если связано)? как оно может попадать в эту таблицу?

        UNIQUE KEY (`loanStateID`),
        UNIQUE KEY (`fullID`, `archived`), # как не должно быть двух одинаковых loanStateID, так и fullID-archived
        CONSTRAINT _loanStateID_consistent CHECK (loanStateID = CONCAT(fullID, "-", SUBSTR(loanStateID, 1 + INSTR(loanStateID, "-")))), # loanStateID сформирован верно

        PRIMARY KEY (`_pk`)
    )
    ENGINE=InnoDB
    -- DEFAULT CHARSET=latin1
;


CREATE OR REPLACE VIEW `loan_trx` as
    SELECT
        loan.fullID,
        loan.archived,
        loan.loanStateID,
        -- FROM_UNIXTIME(NULLIF(CAST(SUBSTRING_INDEX(trx.txID, "-", -1) as DECIMAL(20, 3)) / 1000, 0)) as _trx_dt_expect,
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
;

CREATE OR REPLACE VIEW `loan_item` as
    SELECT
        loan.loanStateID,
        item.*
    FROM
        loan
        INNER JOIN JSON_TABLE(loan.items, '$[*]' COLUMNS(
            `_i`        FOR ORDINALITY,
            `productID` VARCHAR(16)     path '$'
        )) as item
;

-- loan_customItems
CREATE OR REPLACE VIEW `loan_citem` as
    SELECT
        loan.loanStateID,
        customItems.*
    FROM
        loan
        INNER JOIN JSON_TABLE(loan.customItems, '$[*]' COLUMNS(
            `_i`        FOR ORDINALITY,
            `name`      VARCHAR(256)    path '$.name',
            `imageLink` VARCHAR(256)    path '$.imageLink',
            `price`     DECIMAL(15, 4)  path '$.price',
            `qty`       DECIMAL(15, 4)  path '$.qty'
        )) as customItems
;


-- from layers/commonLayer/nodejs/node_modules/models/merchant.js
SET @SQL_MODE_OLD = @@SQL_MODE, @@SQL_MODE = CONCAT(@@SQL_MODE, ',NO_AUTO_VALUE_ON_ZERO'); -- required due to "0" for "Most Popular"
CREATE OR REPLACE TABLE `merchant_category`
    (
        `id`                        INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `name`                      varchar(1024)   DEFAULT "" UNIQUE
    )
    ENGINE=InnoDB
    as
    WITH const(`id`,    `name`                          ) as (
        VALUES( 0,      "Most Popular"                  )
            , ( 1,      "Fashion & Accessories"         )
            , ( 2,      "Aesthetics & Beauty Services"  )
            , ( 3,      "Beauty & Skincare Products"    )
            , ( 4,      "Lifestyle"                     )
            , ( 5,      "Electronics & Tech"            )
            , ( 6,      "Gifts"                         )
            , ( 7,      "Sports & Outdoors"             )
            , ( 8,      "Automotive"                    )
            , ( 9,      "Pets"                          )
            , (10,      "Kids"                          )
            , (11,      "Gaming"                        )
            , (12,      "Travel & Events"               )
            , (13,      "Home"                          )
            , (14,      "Food & Drink"                  )
    )
    SELECT * FROM const
;
SET @@SQL_MODE = @SQL_MODE_OLD;
