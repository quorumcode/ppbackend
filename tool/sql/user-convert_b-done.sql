
/*
* see techdoc/migrate-user-ppids.md
*/

/*
* complete migration, do this AFTER registration-related code is completed!
*/
ALTER TABLE user_generic
    MODIFY user_ppid CHAR(21) CHARSET ascii NOT NULL, -- change to NOT NULL
    MODIFY _pk INT UNSIGNED DEFAULT NULL, -- turn off AUTO_INCREMENT
    DROP PRIMARY KEY, ADD PRIMARY KEY (user_ppid)
;

ALTER TABLE user_wallet
    MODIFY user_ppid CHAR(21) CHARSET ascii NOT NULL, -- change to NOT NULL
    MODIFY _pk INT UNSIGNED DEFAULT NULL, -- turn off AUTO_INCREMENT
    DROP PRIMARY KEY, ADD PRIMARY KEY (user_ppid)
;

ALTER TABLE user_paymeth
    MODIFY `user_ppid` CHAR(21) CHARSET ascii NOT NULL, -- change to NOT NULL
    MODIFY _pk INT UNSIGNED DEFAULT NULL, -- turn off AUTO_INCREMENT
    DROP PRIMARY KEY, ADD PRIMARY KEY (user_ppid, pmID)
;

ALTER TABLE user_device_token
    MODIFY `user_ppid` CHAR(21) CHARSET ascii NOT NULL, -- change to NOT NULL
    MODIFY _pk INT UNSIGNED DEFAULT NULL, -- turn off AUTO_INCREMENT
    DROP PRIMARY KEY, ADD PRIMARY KEY (user_ppid, device)
;
