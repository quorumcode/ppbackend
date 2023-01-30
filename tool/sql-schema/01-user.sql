
/*
    gen v10 return REPLACE(REPLACE(SUBSTR(TO_BASE64(UNHEX(SHA(CONCAT("user", UUID_SHORT())))),1,21),'/','_'),'+','-')
    gen v20 return RPAD(SUBSTR(REGEXP_REPLACE(TO_BASE64(UNHEX(SHA(CONCAT_WS("#", "user", UUID_SHORT(), RAND())))), '[^a-zA-Z0-9]', ''), 1, 21), 21, "0")
    gen v21 seed = CONCAT(UUID_SHORT(), SUBSTR(RAND(), 2, 16)); return RPAD(SUBSTR(REGEXP_REPLACE(TO_BASE64(UNHEX(SHA(seed))), '[^a-zA-Z0-9]', ''), 1, 21), 21, "0")
*/

CREATE TABLE user
-- /* DEBUG */ CREATE OR REPLACE TABLE user
    (
        _seed
            VARCHAR(255) CHARSET ascii NOT NULL
            DEFAULT (CONCAT(UUID_SHORT(), SUBSTR(RAND(), 2, 16))),

        user_ppid                                                           -- pollenpay user identifier
            CHAR(21) CHARSET ascii NOT NULL
            DEFAULT (RPAD(SUBSTR(REGEXP_REPLACE(TO_BASE64(UNHEX(SHA(_seed))), '[^a-zA-Z0-9]', ''), 1, 21), 21, "0"))
            CHECK (user_ppid REGEXP BINARY '^[a-zA-Z0-9]{21}$'),

        dt                                                                  -- registration date
            DATETIME(3) NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (user_ppid)
    )
    ENGINE=InnoDB
;
