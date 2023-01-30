
/*
* see techdoc/migrate-user-ppids.md
*/

-- hard reset things
-- ALTER TABLE user_generic            MODIFY _pk INT UNSIGNED DEFAULT NULL, drop key if exists `PRIMARY`, drop if exists `ppid`, drop if exists `user_ppid`, add primary key (_pk), MODIFY _pk INT UNSIGNED DEFAULT NULL AUTO_INCREMENT;
-- ALTER TABLE user_wallet             MODIFY _pk INT UNSIGNED DEFAULT NULL, drop key if exists `PRIMARY`, drop if exists `ppid`, drop if exists `user_ppid`, add primary key (_pk), MODIFY _pk INT UNSIGNED DEFAULT NULL AUTO_INCREMENT;
-- ALTER TABLE user_paymeth            MODIFY _pk INT UNSIGNED DEFAULT NULL, drop key if exists `PRIMARY`, drop if exists `ppid`, drop if exists `user_ppid`, add primary key (_pk), MODIFY _pk INT UNSIGNED DEFAULT NULL AUTO_INCREMENT;
-- ALTER TABLE user_device_token       MODIFY _pk INT UNSIGNED DEFAULT NULL, drop key if exists `PRIMARY`, drop if exists `ppid`, drop if exists `user_ppid`, add primary key (_pk), MODIFY _pk INT UNSIGNED DEFAULT NULL AUTO_INCREMENT;


/*
* introduce ppid stuff for tables storing base user-related entries, fill in later
*/
ALTER TABLE user_generic
    ADD COLUMN      user_ppid CHAR(21) CHARSET ascii DEFAULT NULL FIRST, -- may be null, temporarily
    ADD CONSTRAINT FOREIGN KEY (user_ppid) REFERENCES user (user_ppid)
;

ALTER TABLE user_wallet
    ADD COLUMN      user_ppid CHAR(21) CHARSET ascii DEFAULT NULL FIRST, -- may be null, temporarily
    ADD CONSTRAINT FOREIGN KEY (user_ppid) REFERENCES user (user_ppid)
;

ALTER TABLE user_paymeth
    ADD COLUMN      user_ppid CHAR(21) CHARSET ascii DEFAULT NULL FIRST, -- may be null, temporarily
    ADD CONSTRAINT FOREIGN KEY (user_ppid) REFERENCES user (user_ppid)
;

ALTER TABLE user_device_token
    ADD COLUMN      user_ppid CHAR(21) CHARSET ascii DEFAULT NULL FIRST, -- may be null, temporarily
    ADD CONSTRAINT FOREIGN KEY (user_ppid) REFERENCES user (user_ppid)
;


/*
* fill in from _user_legacy
*/
UPDATE user_generic         as u LEFT JOIN _user_legacy as ul ON ul.user_id_legacy = u.user SET u.user_ppid = ul.user_ppid WHERE u.user_ppid is null and ul.user_ppid is not null;
UPDATE user_wallet          as u LEFT JOIN _user_legacy as ul ON ul.user_id_legacy = u.user SET u.user_ppid = ul.user_ppid WHERE u.user_ppid is null and ul.user_ppid is not null;
UPDATE user_paymeth         as u LEFT JOIN _user_legacy as ul ON ul.user_id_legacy = u.user SET u.user_ppid = ul.user_ppid WHERE u.user_ppid is null and ul.user_ppid is not null;
UPDATE user_device_token    as u LEFT JOIN _user_legacy as ul ON ul.user_id_legacy = u.user SET u.user_ppid = ul.user_ppid WHERE u.user_ppid is null and ul.user_ppid is not null;
