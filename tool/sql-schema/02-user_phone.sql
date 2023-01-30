
CREATE TABLE user_phone
-- /* DEBUG */ CREATE OR REPLACE TABLE user_phone
    (
        rid         INT UNSIGNED    NOT NULL AUTO_INCREMENT,                -- primary key for this table ("row id")
        user_ppid   CHAR(21)        CHARSET ascii NOT NULL,                 -- pollenpay user identifier
        phone       VARCHAR(32)     CHARSET ascii NOT NULL,                 -- actual phone
        dt_beg      DATETIME(3)     DEFAULT CURRENT_TIMESTAMP,              -- user adds or confirms phone
        dt_end      DATETIME(3)     DEFAULT '9999-12-31 23:59:59.999',      -- linkage ends (user removes phone, someone else confirms ownership etc)

        confirmed   BOOL            DEFAULT FALSE NOT NULL                  -- link state: "ownership is confirmed"
                    CHECK(confirmed IN (0, 1)),                             -- may be false or true only
        login       BOOL            DEFAULT NULL                            -- link state: "used for login"; null is used for relax unique constraint;
                    CHECK (login IS NULL OR (confirmed AND login = 1)),     -- may not be false ever; may be null or have to be 'confirmed' to be true

        PERIOD FOR `link` (dt_beg, dt_end),

        UNIQUE KEY user2phone (user_ppid, phone, link WITHOUT OVERLAPS),    -- for any point of time, there may not be a duplicate user-phone pairs (note that it is allowed if linkship periods does not overlap)
        UNIQUE KEY phone2login (phone, login, link WITHOUT OVERLAPS),       -- for any point of time, 'login' phone may only refer to single user; added/confirmed phone may refer to any amount of distinct users

        CONSTRAINT FOREIGN KEY (user_ppid) REFERENCES user (user_ppid),     -- enforce user record exists

        PRIMARY KEY (rid)
    )
    ENGINE=InnoDB
;



--
-- // ADD PHONE (ppid must exist)
-- SET @now = NOW(3);
-- SET @user_ppid = 'alice', @phone = '777';
-- START TRANSACTION;
-- SET @user_ppid_exists = (SELECT 1 FROM user WHERE ppid = @user_ppid);
-- if (!@user_ppid_exists) signal_rollback "This should be constrainted with a foreign key linked to user."
-- INSERT IGNORE INTO user_phone SET user_ppid = @user_ppid, phone = @phone, dt_beg = @now, confirmed = 0, login = null;
-- UPDATE user_phone FOR PORTION OF link FROM @now TO DEFAULT(dt_end) SET confirmed = 0 WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone = @phone AND confirmed = 0;
-- COMMIT;
--
-- // CONFIRM ADDITIONAL PHONE AND TRY TO SET IT AS LOGIN / REGISTER NEW USER WITH PHONE BEING CONFIRMED AND SET AS LOGIN
-- SET @now = NOW(3);
-- SET @user_ppid = 'alice', @phone = '777'; // use null for @user_ppid to mark that it's a new user registration: ppid will be allocated
-- START TRANSACTION;
-- SET @user_ppid_other = (SELECT user_ppid FROM user_phone WHERE dt_beg <= @now AND dt_end > @now AND user_ppid != @user_ppid AND phone = @phone AND login);
-- if (@user_ppid is null and @user_ppid_other) signal_rollback 'Sorry, but this phone may not be used for registration. Please, contact support.';
-- if (@user_ppid is null) (allocate ppid, set @user_ppid = new ppid);
-- INSERT IGNORE INTO user_phone SET user_ppid = @user_ppid, phone = @phone, dt_beg = @now, confirmed = 1, login = null;
-- UPDATE user_phone FOR PORTION OF link FROM @now TO DEFAULT(dt_end) SET confirmed = 1, login = IF(@user_ppid_other, null, 1) WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone = @phone;
-- if (@user_ppid_other) signal_commit 'The phone is confirmed, but you can not use it for login, sorry. Please, contact support.';
-- COMMIT;
--
-- // SET LOGIN PHONE
-- SET @now = NOW(3);
-- SET @user_ppid = 'alice', @phone = '777';
-- START TRANSACTION;
-- UPDATE user_phone FOR PORTION OF link FROM @now TO DEFAULT(dt_end) SET login = 1 WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone = @phone;
-- -- the previous operation either:
-- --  sets the phone to be 'login' if it's not already or duplicates a row with new period -- this is successful result
-- --  does nothing for phone not being added earlier -- this is also a successful result
-- --  fails if the phone is not confirmed (violates 'login' constraint) and also fails if a phone is already marked as login for someone else (violates 'phone2login' unique key)
-- -- so having a failure it should be checked for the reason and correctly signaled!
-- COMMIT;
--
-- // UNSET LOGIN PHONE
-- SET @now = NOW(3);
-- SET @user_ppid = 'alice', @phone = '777';
-- START TRANSACTION;
-- SET @is_last = (SELECT 0 = COUNT(*) FROM user_phone WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone != @phone AND login);
-- if (@is_last) signal_rollback 'You can not do this: there should be at least one phone used for sign into your account.';
-- UPDATE user_phone FOR PORTION OF link FROM @now TO DEFAULT(dt_end) SET login = null WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone = @phone;
-- /* the previous operation does nothing for not phone not being added earlier */
-- COMMIT;
--
-- // UNLINK PHONE
-- SET @now = NOW(3);
-- SET @user_ppid = 'alice', @phone = '777';
-- START TRANSACTION;
-- SET @is_last = (SELECT 0 = COUNT(*) FROM user_phone WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone != @phone);
-- if (@is_last) signal_rollback 'You can not unlink the last phone from your account.';
-- UPDATE user_phone SET dt_end = @now WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone = @phone;
-- /* the previous operation does nothing for phone not being added earlier */
-- COMMIT;
--
-- // EDIT PHONE
-- SET @now = NOW(3);
-- SET @user_ppid = 'alice', @phone_old = '777', @phone_new = '888';
-- START TRANSACTION;
-- UPDATE user_phone SET dt_end = @now WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone = @phone_old AND confirmed = 0;
-- INSERT IGNORE INTO user_phone SET user_ppid = @user_ppid, phone = @phone_new, dt_beg = @now, confirmed = 0, login = null;
-- UPDATE user_phone FOR PORTION OF link FROM @now TO DEFAULT(dt_end) SET confirmed = 0 WHERE dt_beg <= @now AND dt_end > @now AND user_ppid = @user_ppid AND phone = @phone_new AND confirmed = 0;
-- COMMIT;
--
--
-- // get user by confirmed phone (present)
-- SELECT user_ppid, phone, confirmed, dt_beg FROM user_phone WHERE dt_beg <= now() AND dt_end > now() AND confirmed = 1 AND phone = '777';
--
-- // get user phones (both added and confirmed) (present)
-- SELECT user_ppid, phone, confirmed, dt_beg FROM user_phone WHERE dt_beg <= now() AND dt_end > now() AND user_ppid = 'alice';
--

