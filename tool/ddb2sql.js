
// console patchwork
{
    const util = require("util");
    Object.assign(util.inspect.defaultOptions, {
        depth: 5,
        colors: true,
    });

    console.status = (info, todo, i) => {
        let out = "";
        if ("number" == typeof i) {
            const perc = 100 * i / todo;
            const todo_len = String(todo).length;
            const ipad = " ".repeat(todo_len);
            out = util.format("\r\x1b[K%s: %s%% # %s / %s ", info, ("   " + Math.floor(perc)).slice(-3), (ipad + String(i + 1)).slice(-todo_len), todo);
        }
        else {
            out = util.format("\r\x1b[K%s: %s%s", info, todo, i ? "\n" : "");
        }
        process.stderr.write(out);
    };
}

/**************************************************************************************************/

const dothings = {
    users:      false, // true,
    merchants:  false, // true,
    loans:      false, // true,
};

const AWS = require('aws-sdk');
const ddb_doc = new AWS.DynamoDB.DocumentClient(require('aws-layer/dynamo/cfg'));

const mysql_client = require('pp-mysql/client');
const { Q, q, qlike } = mysql_client.shorthands();

// (remote) source: select rows from table
let rsrc_select_rows = async (src_tbl) => {
    let params = { TableName: src_tbl, ConsistentRead: true };
    let LastEvaluatedKey = null;
    const src_rows = [];
    let r;
    do {
        r = await ddb_doc.scan(params).promise();
        console.log({ "scanned": src_tbl, "found items": r.Count });
        src_rows.push(...(r.Items ?? []));
    } while ((params.ExclusiveStartKey = r.LastEvaluatedKey));
    //console.table(src_rows);
    return src_rows;
};

// (dump) source: select rows from table
let dsrc_select_rows = async (src_tbl) => {
    const path = require('path');
    const fs = require('fs').promises;

    const src_dir = path.join(process.env.DUMP_DIR, src_tbl, "data");
    const src_fns =
        (await fs.readdir(src_dir, { withFileTypes: true }))
        .filter(src => !src.isDirectory() && (".json" === path.extname(src.name)))
        .map(src => path.join(src_dir, src.name))
        .sort();

    const src_rows = [];
    for (let src_fn of src_fns) {
        //console.log({ "selecting from": src_fn });
        const src_data_json = await fs.readFile(src_fn);
        const src_items = JSON.parse(src_data_json).Items; // .slice(0, 100);
        console.log({ "parsed": src_fn, "found items": src_items.length });
        //console.log({ src_fn, src_items, src_rows });
        src_rows.push(...src_items.map(src_item => AWS.DynamoDB.Converter.unmarshall(src_item)));
    }
    //console.table(src_rows);
    return src_rows;
};

let src_select_rows = "DUMP_DIR" in process.env
    ? dsrc_select_rows
    : rsrc_select_rows;


const stat_dsts = { }; // dst_tbl => { affectedRows: ..., changedRows: ... };

// destination: insert `src_row` to `dst_tbl`
// using transformation defined via `f2sqlv` (field => sql_value), refer to orig data via @src sql variable
// store original json in `f_orig`
// store unimported json in `f_rest` (original json object excluding fields from `ff_used` array)
// on duplicate key `f_uk` perform an update (if there are at least 1 field in ff_uk)
let dst_insert_row = async (conn, dst_tbl, src_row, f_orig, f_rest, ff_uk, f2sqlv, ff_used) => {
    if ("object" != typeof src_row) throw new Error("src_row is expected to be an object, but it's " + JSON.stringify(src_row));
    const vv_rest = { ...src_row };
    for (const f_used of Array.from(ff_used)) delete vv_rest[f_used];
    const sql_orig = JSON.stringify(src_row);
    const sql_rest = JSON.stringify(vv_rest);

    let sql = `INSERT INTO ${Q(dst_tbl)} SET ${Q(f_orig)} = (@src := ${q(sql_orig)}), ${Q(f_rest)} = (@rest := ${q(sql_rest)}), `;
    const ff_uk_set = new Set(Array.isArray(ff_uk) ? ff_uk : [ff_uk]);
    const ff_uk_pos = new Set();
    const sql_set = [];
    for (const [f, sqlv] of Object.entries(f2sqlv)) {
        if (ff_uk_set.has(f)) ff_uk_pos.add(sql_set.length);
        sql_set.push(`${Q(f)} = ${sqlv}`);
    }
    if (ff_uk_pos.size != ff_uk_set.size) {
        throw new Error("ff_uk = " + JSON.stringify(ff_uk.entries()) + ", but not all fields present in f2sqlv!");
    }
    sql += sql_set.join(", ");
    if (ff_uk_pos.size) {
        sql += ` ON DUPLICATE KEY UPDATE ${Q(f_orig)} = @src, ${Q(f_rest)} = @rest, `;
        for (const f_uk_pos of ff_uk_pos.entries()) sql_set.splice(f_uk_pos, 1);
        sql += sql_set.join(", ");
    }

    const [rr, fields] = await conn.query_promise(sql);
    //console.log({ rr });
    //console.log({ sql, pk: rr.insertId, dst_tbl });
    //console.log({ pk: rr.insertId, dst_tbl });
    const stat_dst = (stat_dsts[dst_tbl] ??= { affectedRows: 0, changedRows: 0 });
    stat_dst.affectedRows += rr.affectedRows;
    stat_dst.changedRows += rr.changedRows;
};

async function main() {
    let conn = await mysql_client.getConnection_promise();

    try {
        await conn.query_promise(`START TRANSACTION`);

        if (dothings.users) {
            const [src_tbl, dst_tbl] = ["userTable", "user*"];
            const status_info = "importing " + src_tbl + " to " + dst_tbl;

            //await conn.query_promise(`DELETE FROM ${Q("user_generic")}`);
            //await conn.query_promise(`DELETE FROM ${Q("user_wallet")}`);
            //await conn.query_promise(`DELETE FROM ${Q("user_paymeth")}`);
            //await conn.query_promise(`DELETE FROM ${Q("user_device_token")}`);

            let src_rows = await src_select_rows(src_tbl);
            for (const [i, src_row] of src_rows.entries()) { // src_rows.slice(0, 10)
                console.status(status_info, src_rows.length, i);
                //console.log({ dst_tbl, record: src_row.record });
                let rr, fields;
                switch (true) {
                    case src_row.record === "customer":
                        await dst_insert_row(conn, "user_generic", src_row, "_orig_customer", "_rest_customer", ["user"], {
                            user:                   `JSON_VALUE(@src, "$.user")`,
                            stripeID:               `JSON_VALUE(@src, "$.stripeID")`,
                            lerexID:                `JSON_VALUE(@src, "$.lerexID")`,
                            primaryPaymentMethod:   `JSON_VALUE(@src, "$.primaryPaymentMethod")`,
                        }, ["user", "record", "stripeID", "lerexID", "primaryPaymentMethod"]);
                        break;

                    case src_row.record === "primary":
                        await dst_insert_row(conn, "user_generic", src_row, "_orig_primary", "_rest_primary", ["user"], {
                            user:                   `JSON_VALUE(@src, "$.user")`,
                            primaryStatus:          `JSON_VALUE(@src, "$.primaryStatus")`,
                            primaryNumber:          `JSON_VALUE(@src, "$.primaryNumber")`,
                        }, ["user", "record", "primaryStatus", "primaryNumber"]);

                    case src_row.record === "recovery":
                        await dst_insert_row(conn, "user_generic", src_row, "_orig_recovery", "_rest_recovery", ["user"], {
                            user:                   `JSON_VALUE(@src, "$.user")`,
                            recoveryStatus:         `JSON_VALUE(@src, "$.recoveryStatus")`,
                            recoveryNumber:         `JSON_VALUE(@src, "$.recoveryNumber")`,
                        }, ["user", "record", "recoveryStatus", "recoveryNumber"]);

                    case src_row.record === "settings":
                        await dst_insert_row(conn, "user_generic", src_row, "_orig_settings", "_rest_settings", ["user"], {
                            user:                   `JSON_VALUE(@src, "$.user")`,
                            primaryStatus2:          `JSON_VALUE(@src, "$.primaryStatus")`,          // DUPLICATES primary record! (see user_generic)
                            primaryNumber2:          `JSON_VALUE(@src, "$.primaryNumber")`,          // DUPLICATES primary record! (see user_generic)
                            marketing:              `JSON_EXTRACT(@src, "$.marketing")`,
                            notifications:          `JSON_EXTRACT(@src, "$.notifications")`,
                        }, ["user", "record", "primaryStatus", "primaryNumber", "marketing", "notifications"]);
                        break;

                    case src_row.record === "details":
                        await dst_insert_row(conn, "user_generic", src_row, "_orig_details", "_rest_details", ["user"], {
                            user:                   `JSON_VALUE(@src, "$.user")`,
                            emailConfirmed:         `JSON_VALUE(@src, "$.emailConfirmed")`, // `IFNULL(JSON_VALUE(@src, "$.emailConfirmed"), FALSE)`,
                            dob:                    `JSON_VALUE(@src, "$.dob")`,
                            identityId:             `JSON_VALUE(@src, "$.identityId")`,
                            sex:                    `JSON_VALUE(@src, "$.sex")`,
                            name:                   `JSON_EXTRACT(@src, "$.name")`,
                            email:                  `JSON_VALUE(@src, "$.email")`,
                            nickname:               `JSON_VALUE(@src, "$.nickname")`,
                            address:                `JSON_EXTRACT(@src, "$.address")`,
                        }, ["user", "record", "emailConfirmed", "dob", "identityId", "sex", "name", "email", "nickname", "address"]);
                        break;

                    case src_row.record === "status":
                        await dst_insert_row(conn, "user_generic", src_row, "_orig_status", "_rest_status", ["user"], {
                            user:                   `JSON_VALUE(@src, "$.user")`,
/* INCOMPAT */              created:                `FROM_UNIXTIME(CAST(JSON_VALUE(@src, "$.created") as DECIMAL(20, 3)))`,
                            deleted:                `IFNULL(JSON_VALUE(@src, "$.deleted"), FALSE)`,
                            blocked:                `IFNULL(JSON_VALUE(@src, "$.blocked"), FALSE)`,
                            softlocked:             `IFNULL(JSON_VALUE(@src, "$.softlocked"), FALSE)`,
/* INCOMPAT */              KYCDate:                `FROM_UNIXTIME(CAST(JSON_VALUE(@src, "$.KYCDate") as DECIMAL(20, 3)))`,
                            lerexKYCSubmitted:      `JSON_VALUE(@src, "$.lerexKYCSubmitted")`,
                            idFileLink:             `JSON_VALUE(@src, "$.idFileLink")`,
                            verificationID:         `JSON_VALUE(@src, "$.verificationID")`,
                            addressFileLink:        `JSON_VALUE(@src, "$.addressFileLink")`,
                            addressVerificationID:  `JSON_VALUE(@src, "$.addressVerificationID")`,
                            tmp_addressFileLink:        `JSON_VALUE(@src, "$.tmp_addressFileLink")`,
                            tmp_addressVerificationID:  `JSON_VALUE(@src, "$.tmp_addressVerificationID")`,
                        }, ["user", "record", "created", "deleted", "blocked", "softlocked", "KYCDate", "lerexKYCSubmitted", "idFileLink", "verificationID", "addressFileLink", "addressVerificationID", "tmp_addressFileLink", "tmp_addressVerificationID"]);
                        break;

                    case src_row.record === "wallet":
                        await dst_insert_row(conn, "user_wallet", src_row, "_orig", "_rest", ["user"], {
                            user:                   `JSON_VALUE(@src, "$.user")`,
                            limit:                  `JSON_VALUE(@src, "$.limit")`,
                            individualAllowance:    `JSON_VALUE(@src, "$.individualAllowance")`,
                            activeCard:             `JSON_VALUE(@src, "$.activeCard")`,
                            card:                   `JSON_EXTRACT(@src, "$.card")`,
/* INCOMPAT */              lockTimestamp:          `STR_TO_DATE(JSON_VALUE(@src, "$.lockTimestamp"), '%Y-%m-%dT%T.%fZ')`, // ISO 8601: '2021-12-06T12:50:38.257Z' vs '%Y-%m-%dT%TZ'
                            waitlist:               `JSON_VALUE(@src, "$.waitlist")`,
                        }, ["user", "record", "limit", "activeCard", "card", "lockTimestamp", "waitlist", "individualAllowance"]);
                        break;

                    //case src_row.record.startsWith("paymentMethod-"): // paymentMethod-pm_1K1qumLf6bScP1MibS4qW9Wk
                    case src_row.record === ("paymentMethod-" + src_row.pmID):
                        await dst_insert_row(conn, "user_paymeth", src_row, "_orig", "_rest", ["user"], {
                            user:                   `JSON_VALUE(@src, "$.user")`,
                            pmID:                   `JSON_VALUE(@src, "$.pmID")`,
/* INCOMPAT */              addedTimestampS:        `FROM_UNIXTIME(CAST(JSON_VALUE(@src, "$.addedTimestampS") as DECIMAL(20, 3)))`,
                            type:                   `JSON_VALUE(@src, "$.type")`,
                            digits:                 `JSON_VALUE(@src, "$.digits")`,
                        }, ["user", "record", "pmID", "addedTimestampS", "type", "digits"]);
                        break;

                    case src_row.record === "apns":
                        //console.log({ "apns": src_row });
                        for (let [src_row_device, src_row_device_token] of Object.entries(src_row.devices)) {
                            if (Array.isArray(src_row_device_token)) src_row_device_token = src_row_device_token[src_row_device_token.length - 1];
                            await dst_insert_row(conn, "user_device_token", src_row, "_orig", "_rest", ["user", "device"], {
                                user:               `JSON_VALUE(@src, "$.user")`,
                                device:             `${q(src_row_device)}`,
                                //token:              `${q(JSON.stringify(src_row_device_token))}`,
                                token:              `${q(src_row_device_token)}`,
                            }, ["user", "record", "devices"]);
                        }
                        break;

                    default:
                        console.log(src_row);
                        throw new Error("Unknown src_row.record = " + JSON.stringify(src_row.record));
                }
            }

            console.status(status_info, "done " + String(src_rows.length) + " item(s)", true);
        }

        if (dothings.merchants) {
            const [src_tbl, dst_tbl] = ["merchantTable", "merchant*"];
            const status_info = "importing " + src_tbl + " to " + dst_tbl;

            //await conn.query_promise(`DELETE FROM ${Q("merchant")}`);
            //await conn.query_promise(`DELETE FROM ${Q("merchant_user")}`);
            //await conn.query_promise(`DELETE FROM ${Q("merchant_address")}`);
            //await conn.query_promise(`DELETE FROM ${Q("merchant_product")}`);

            let src_rows = await src_select_rows(src_tbl);
            for (const [i, src_row] of src_rows.entries()) { // src_rows.slice(0, 10)
                console.status(status_info, src_rows.length, i);
                //console.log({ dst_tbl, record: src_row.record });

                let rr, fields;
                switch (true) {
                    case src_row.record === "details":
                        await dst_insert_row(conn, "merchant", src_row, "_orig", "_rest", ["merchant"], {
                            merchant:               `JSON_VALUE(@src, "$.merchant")`,
                            //record:               `JSON_VALUE(@src, "$.record")`,
                            batch:                  `JSON_EXTRACT(@src, "$.batch")`,
                            parent:                 `JSON_EXTRACT(@src, "$.parent")`,
                            deal:                   `JSON_EXTRACT(@src, "$.deal")`,
                            direct:                 `JSON_EXTRACT(@src, "$.direct")`,
                            allowCustomAmounts:     `JSON_VALUE(@src, "$.allowCustomAmounts")`,
                            link:                   `JSON_VALUE(@src, "$.link")`,
                            logoURL:                `JSON_VALUE(@src, "$.logoURL")`,
                            merchantName:           `JSON_VALUE(@src, "$.merchantName")`,
                            imageURL:               `JSON_VALUE(@src, "$.imageURL")`,
                            inStore:                `JSON_VALUE(@src, "$.inStore")`,
                            online:                 `JSON_VALUE(@src, "$.online")`,
                            location:               `JSON_EXTRACT(@src, "$.location")`,
                            subcategory:            `JSON_EXTRACT(@src, "$.subcategory")`,
                            category:               `JSON_EXTRACT(@src, "$.category")`,
                            relevanceIndex:         `JSON_EXTRACT(@src, "$.relevanceIndex")`,
                            popular:                `JSON_EXTRACT(@src, "$.popular")`,
                            contactDetails:         `JSON_EXTRACT(@src, "$.contactDetails")`,
                            hidden:                 `IFNULL(JSON_VALUE(@src, "$.hidden"), null)`,
                        }, ["merchant", "record", "batch", "parent", "deal", "direct", "allowCustomAmounts", "link", "logoURL", "merchantName", "imageURL", "inStore", "online", "location", "subcategory", "category", "relevanceIndex", "popular", "contactDetails", "hidden"]);
                        break;

                    case src_row.record === "user":
                        await dst_insert_row(conn, "merchant_user", src_row, "_orig", "_rest", ["merchant"], {
                            merchant:               `JSON_VALUE(@src, "$.merchant")`,
                            //record:               `JSON_VALUE(@src, "$.record")`,
                            batch:                  `JSON_EXTRACT(@src, "$.batch")`,
                            email:                  `JSON_VALUE(@src, "$.email")`,
                            hash:                   `JSON_VALUE(@src, "$.hash")`,
                            settlements:            `JSON_EXTRACT(@src, "$.settlements")`,
                            billing:                `JSON_EXTRACT(@src, "$.billing")`,
                        }, ["merchant", "record", "batch", "email", "hash", "settlements", "billing"]);
                        break;

                    case src_row.record.startsWith("location-"): // location-1
                    //case src_row.record === ("location-" + src_row.XXX):
                        await dst_insert_row(conn, "merchant_location", src_row, "_orig", "_rest", ["merchant", "_record"], {
                            merchant:               `JSON_VALUE(@src, "$.merchant")`,
                            _record:                `JSON_VALUE(@src, "$.record")`,
                            address:                `JSON_VALUE(@src, "$.address")`,
                            lng:                    `JSON_EXTRACT(@src, "$.lng")`,
                            lat:                    `JSON_EXTRACT(@src, "$.lat")`,
                        }, ["merchant", "record", "address", "lng", "lat"]);
                        break;

                    //case src_row.record.startsWith("product-"): // product-LugiCz2X
                    case src_row.record === ("product-" + src_row.productID):
                        await dst_insert_row(conn, "merchant_product", src_row, "_orig", "_rest", ["merchant", "productID"], {
                            merchant:               `JSON_VALUE(@src, "$.merchant")`,
                            productID:              `JSON_VALUE(@src, "$.productID")`,
                            priceSansTax:           `JSON_VALUE(@src, "$.priceSansTax")`,
                            totalPrice:             `JSON_VALUE(@src, "$.totalPrice")`,
                            productGroupID:         `JSON_VALUE(@src, "$.productGroupID")`,
                            name:                   `JSON_VALUE(@src, "$.name")`,
                            imageURL:               `JSON_VALUE(@src, "$.imageURL")`,
                            index:                  `JSON_VALUE(@src, "$.index")`,
                            taxPercent:             `JSON_VALUE(@src, "$.taxPercent")`,
                        }, ["merchant", "record", "productID", "priceSansTax", "totalPrice", "productGroupID", "name", "imageURL", "index", "taxPercent"]);
                        break;

                    //case src_row.record.startsWith("productGroup-"): // productGroup-gKpIJT4O
                    case src_row.record === ("productGroup-" + src_row.productGroupID):
                        await dst_insert_row(conn, "merchant_productgroup", src_row, "_orig", "_rest", ["merchant", "productGroupID"], {
                            merchant:               `JSON_VALUE(@src, "$.merchant")`,
                            productGroupID:         `JSON_VALUE(@src, "$.productGroupID")`,
                            name:                   `JSON_VALUE(@src, "$.name")`,
                            index:                  `JSON_VALUE(@src, "$.index")`,
                        }, ["merchant", "record", "productGroupID", "name", "index"]);
                        break;

                    default:
                        console.log(src_row);
                        throw new Error("Unknown src_row.record = " + JSON.stringify(src_row.record));
                }
            }

            console.status(status_info, "done " + String(src_rows.length) + " item(s)", true);
        }

        if (dothings.loans) {
            const [src_tbl, dst_tbl] = ["loanTable", "loan"];
            const status_info = "importing " + src_tbl + " to " + dst_tbl;

            let src_rows = await src_select_rows(src_tbl);

            //await conn.query_promise(`DELETE FROM ${Q(dst_tbl)}`);

            for (const [i, src_row] of src_rows.entries()) { // src_rows.slice(0, 10)
                console.status(status_info, src_rows.length, i);
                await dst_insert_row(conn, dst_tbl, src_row, "_orig", "_rest", ["loanStateID"], {
/* INCOMPAT */      created:            `FROM_UNIXTIME(CAST(JSON_VALUE(@src, "$.created") as DECIMAL(20, 3)) / 1000)`,
                    transactions:       `JSON_EXTRACT(@src, "$.transactions")`,
                    userID:             `JSON_VALUE(@src, "$.userID")`,
/* INCOMPAT */      archived:           `FROM_UNIXTIME(NULLIF(CAST(JSON_VALUE(@src, "$.archived") as DECIMAL(20, 3)), 0) / 1000)`,
                    total:              `JSON_VALUE(@src, "$.total")`,
                    overdue:            `JSON_VALUE(@src, "$.overdue")`,
                    pollenReference:    `JSON_VALUE(@src, "$.pollenReference")`,
                    balance:            `JSON_VALUE(@src, "$.balance")`,
                    merchantID:         `CASE @v := JSON_EXTRACT(@src, "$.merchantID") WHEN "false" THEN NULL ELSE JSON_VALUE(@v, "$") END`,
                    paymentMethod:      `JSON_VALUE(@src, "$.paymentMethod")`,
                    loanStateID:        `JSON_VALUE(@src, "$.loanStateID")`,
                    fullID:             `JSON_VALUE(@src, "$.fullID")`,
                    referenceCode:      `JSON_VALUE(@src, "$.referenceCode")`,
                    items:              `JSON_EXTRACT(@src, "$.items")`,
                    customItems:        `JSON_EXTRACT(@src, "$.customItems")`,
                    //otherMerchant:      `NULLIF(JSON_VALUE(@src, "$.otherMerchant"), FALSE)`,
                    otherMerchant:      `CASE @v := JSON_EXTRACT(@src, "$.otherMerchant") WHEN "false" THEN NULL ELSE JSON_VALUE(@v, "$") END`,
                    delayAdvancePayment:`JSON_EXTRACT(@src, "$.delayAdvancePayment")`,
                    //deleted:            `JSON_EXTRACT(@src, "$.deleted")`, // deleted Delete Deleted
/* STRANGE */       deleted:            `COALESCE(JSON_VALUE(@src, "$.deleted"), JSON_VALUE(@src, "$.Delete"), JSON_VALUE(@src, "$.Deleted"))`,
                }, [
                    "created", "transactions", "userID", "archived", "total", "overdue", "pollenReference",
                    "balance", "merchantID", "paymentMethod", "loanStateID", "fullID", "referenceCode",
                    "items", "customItems", "otherMerchant", "delayAdvancePayment",
                    "deleted", "Delete", "Deleted", // !!!!!!!!!!
                ]);
            }
            console.status(status_info, "done " + String(src_rows.length) + " item(s)", true);
        }

        //console.table(stat_dsts);
        console.status("committing", "...");
        await conn.query_promise('COMMIT');
        console.status("committing", "done", true);
    }
    catch (err) {
        console.error(err);
    }
    finally {
        conn.release();
    }
};

main();
