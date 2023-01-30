ALTER TABLE `user_paymeth`
    ADD `expire_year` INT UNSIGNED DEFAULT NULL COMMENT 'Year of card expire',
    ADD `expire_month` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Month of card expire',
    ADD `country_code` CHAR(2) DEFAULT NULL COMMENT 'Card country code ISO 3166-1 Alpha-2',
    ADD `funding` VARCHAR(31) DEFAULT NULL COMMENT 'Funding of card (credit/debit/prepaid/unknown)',
    ADD `support3dsecure` BOOL DEFAULT NULL COMMENT 'Is card support 3D secure',
    ADD `name` VARCHAR(127) DEFAULT NULL COMMENT 'Cardholder name',
    ADD `fingerprint` VARCHAR(127) DEFAULT NULL COMMENT 'Uniquely identifies this particular card number';
