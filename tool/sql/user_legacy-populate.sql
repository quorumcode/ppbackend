
/*
* see techdoc/migrate-user-ppids.md
*/

/*
* a birdseye-overview of any phone number known to the system
*/
CREATE OR REPLACE TABLE _user_legacy_tmp
    (
        rid                                         -- primary key for this table ("row id")
            INT UNSIGNED NOT NULL AUTO_INCREMENT,

        user_ppid                                   -- user_ppid that was assigned to this phone as a result of migration or earlier
            CHAR(21) CHARSET ascii DEFAULT NULL,

        origin                                      -- where spotted
            ENUM("generic", "generic-primary", "generic-recovery", "wallet", "paymeth", "apns", "loan-txid") NOT NULL,

        user_id_legacy                              -- primary number obtained from legacy data structure
            VARCHAR(32) NOT NULL,

        _seed
            VARCHAR(255) CHARSET ascii /* NOT NULL */
            GENERATED ALWAYS AS (CONCAT("legacy.", user_id_legacy)),

        phone_raw                                   -- note that it's varchar
            VARCHAR(32) NOT NULL,

        phone                                       -- normalized value (kinda)
            VARCHAR(32) /* NOT NULL */
            GENERATED ALWAYS AS (REGEXP_REPLACE(phone_raw, "^\\+", "")),

        dt_add                                      -- dt of the phone was linked to user obtained from legacy data structure (may be null -- which is "unknown")
            DATETIME(3) DEFAULT NULL,

        confirmed                                   -- confirmation state obtained from legacy data structure (may be null -- which is "unknown")
            BOOL DEFAULT NULL,

        UNIQUE KEY (user_ppid, origin, phone_raw),
        -- UNIQUE KEY (user_id_legacy, origin, phone_raw),
        PRIMARY KEY (rid)
    )
    ENGINE=InnoDB
    as
    WITH
        loan_trx as (
            SELECT
                loan.loanStateID,
                SUBSTRING_INDEX(trx.txID, "-", 1) as phone,
                loan.created as dt
            FROM
                loan
                INNER JOIN JSON_TABLE(loan.transactions, '$[*]' COLUMNS(
                    `txID`      VARCHAR(64)     path '$.txID'
                )) as trx
        ),
        data as (
            SELECT /* just for column types to be stable */
                CAST(NULL as VARCHAR(32)) as origin,
                CAST(NULL as VARCHAR(32)) as user_id_legacy,
                CAST(NULL as VARCHAR(32)) as phone_raw,
                CAST(NULL as DATETIME(3)) as dt_add,
                CAST(NULL as INT) as confirmed
            HAVING 0
            UNION ALL
                SELECT
                    "generic" as origin,
                    user as user_id_legacy,
                    user as phone_raw,
                    created as dt_add,
                    NULL as confirmed
                FROM user_generic
            UNION ALL
                SELECT
                    "generic-primary" as origin,
                    user as user_id_legacy,
                    primaryNumber as phone_raw,
                    created as dt_add,
                    primaryStatus as confirmed
                FROM user_generic
                WHERE primaryNumber IS NOT NULL
            -- UNION ALL
            --     SELECT
            --         "generic-recovery" as origin,
            --         user as user_id_legacy,
            --         recoveryNumber as phone_raw,
            --         created as dt_add,
            --         recoveryStatus as confirmed
            --     FROM user_generic
            --     WHERE recoveryNumber IS NOT NULL
            UNION ALL
                SELECT
                    "wallet" as origin,
                    user as user_id_legacy,
                    user as phone_raw,
                    NULL as dt_add,
                    NULL as confirmed
                FROM user_wallet
            UNION ALL
                SELECT
                    "paymeth" as origin,
                    user as user_id_legacy,
                    user as phone_raw,
                    MIN(addedTimestampS) as dt_add,
                    NULL as confirmed
                FROM user_paymeth
                GROUP BY phone_raw
            UNION ALL
                SELECT DISTINCT
                    "apns" as origin,
                    user as user_id_legacy,
                    user as phone_raw,
                    NULL as dt_add,
                    NULL as confirmed
                FROM user_device_token
            UNION ALL
                SELECT
                    "loan-txid" as origin,
                    phone as user_id_legacy,
                    phone as phone_raw,
                    MIN(dt) as dt_add,
                    1 as confirmed
                FROM loan_trx
                GROUP BY phone_raw
        )
    SELECT
        *
    FROM
        data
;

SELECT
    @_user_legacy_batch := DATE_FORMAT(now(), '%Y%m%d%H%i%s') as _user_legacy_batch,
    @_user_legacy := CONCAT('_user_legacy_', @_user_legacy_batch) as _user_legacy
;
EXECUTE IMMEDIATE CONCAT('RENAME TABLE _user_legacy_tmp TO ', @_user_legacy);
EXECUTE IMMEDIATE CONCAT('CREATE OR REPLACE VIEW _user_legacy as SELECT * FROM ', @_user_legacy);


-- SHOW FULL TABLES LIKE '_user_legacy%';
-- select * from _user_legacy where origin = "generic-primary" and dt_add is not null and confirmed is not null order by dt_add limit 10;
-- select * from _user_legacy where phone != user_id_legacy limit 10;
-- select * from _user_legacy where phone_raw not like '44%' and phone_raw not like '+44%'; -- limit 10;


-- allocate ppids where needed using main user table
INSERT INTO user (_seed, dt)
WITH
    map as (
        SELECT
            _seed as _seed,
            MIN(dt_add) as dt
        FROM
            _user_legacy
        WHERE
            user_ppid is null
        GROUP BY
            _seed
    )
SELECT
    map._seed as _seed,
    IFNULL(map.dt, '2021-09-01 00:00:00.000') as dt
FROM
    map
    LEFT JOIN user as u ON u._seed = map._seed
WHERE
    u.user_ppid is null
;

-- store that new allocated ppids
UPDATE _user_legacy as map LEFT JOIN user as u ON u._seed = map._seed
SET map.user_ppid = u.user_ppid
WHERE COALESCE(map.user_ppid, u.user_ppid) IS NOT NULL;

-- insert missing entries into user_phone
INSERT IGNORE INTO user_phone (user_ppid, phone, dt_beg /*, dt_end */, confirmed, login)
WITH
    map as (
        SELECT
            user_ppid as user_ppid,
            phone as phone,
            MIN(dt_add) as dt,
            MAX(confirmed) as confirmed
        FROM
            _user_legacy
        WHERE
            user_ppid is not null
        GROUP BY
            user_ppid, phone
    )
SELECT
    map.user_ppid as user_ppid,
    map.phone as phone,
    -- map.dt as dt_beg,
    -- IFNULL(map.dt, NOW()) as dt_beg,
    IFNULL(map.dt, '2021-09-01 00:00:00.000') as dt_beg,
    -- null as dt_end,
    IFNULL(map.confirmed, 0) as confirmed,
    IF(IFNULL(map.confirmed, 0), 1, NULL) as login
FROM
    map
    LEFT JOIN user_phone as up ON 1
        AND up.user_ppid = map.user_ppid
        AND up.phone = map.phone
WHERE 1
    AND map.user_ppid IS NOT NULL
    AND up.user_ppid IS NULL
    -- AND map.dt is not null
    -- AND map.phone = '447949425020'
ORDER BY
    map.dt
;

-- show entries which was not imported and any relations to them which can be found easily
CREATE OR REPLACE VIEW _user_legacy_report as
WITH RECURSIVE
    map as (
        SELECT
            map0.*,
            "[a] no such user_ppid in user_phone" as info
        FROM
            _user_legacy as map0
            LEFT JOIN user_phone as up ON 1
                AND up.user_ppid = map0.user_ppid
                AND up.phone = map0.phone
        WHERE 1
            AND up.user_ppid IS NULL
        UNION
        SELECT
            map1.*,
            "[b] legacy phone match, ppid differ" as info
        FROM
            map as map0
            INNER JOIN _user_legacy as map1 ON 0
                OR (map1.phone = map0.phone and map1.user_ppid != map0.user_ppid)
    )
SELECT * FROM map;

SELECT * FROM _user_legacy_report;
