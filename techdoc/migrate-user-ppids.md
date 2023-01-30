## Migrating to new data schema for user identification


### 1. BACKUP DATABASE
### 2. maybe it's worth putting backend into maintenace mode
### 3. inspect and apply `tool/sql-schema/01-user.sql`
### 4. inspect and apply `tool/sql-schema/02-user_phone.sql`

Now there are vanilla/empty `user` and `user_phone` tables in a database.

### 5. inspect and use `tool/sql/user_legacy-populate.sql` to harvest phones from various places in a database

Each time this script is run, there will appear a `_user_legacy_XXX` table and `_user_legacy` view recreated to point to that table.
Also, `user` and `user_phone` tables are inserted with any missing values.
There should be a report for easily-detectable problems if there were any during import.
Select from `_user_legacy` as well as `_user_legacy_report` to inspect things (and put a glance on a query that report import problems).

This is a point at which a rollback and re-run are quite easy (drop `user` and `user_phone`, drop `_user_legacy_***` without problems),
so any inconsistency should be found out and resolved right here.

### 6. inspect and apply `tool/sql/user-convert_a-init.sql`

This will introduce new fields, foreign keys, etc for `user_***` tables and fill them using values from most recent `_user_legacy`.

### 7. switch code to use new schema, test things, ensure everything is OK

### 8. inspect and apply `tool/sql/user-convert_a-done.sql`

This will complete migration for `user_***` tables, making schema less relaxed.

### 9. having some time passed and if there were no problems, database should be cleaned up to exclude legacy phone references, and only `user_phone` should be used.
