// console patchwork
// https://nodejs.org/api/util.html#utilinspectobject-options
Object.assign(require("util").inspect.defaultOptions, {
    //colors: true, // auto
    breakLength: 1, // make object entries always on separate lines
    maxArrayLength: null, // do not collapse big arrays
    depth: 5,
});


const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient(require('aws-layer/dynamo/cfg'));


const mysql_client = require('pp-mysql/client');
const {
    Q, q, qlike,
    $tbl,
} = mysql_client.shorthands();


process.env.userTable ??= "userTable";
process.env.merchantTable ??= "merchantTable";
process.env.loanTable ??= "loanTable";

const { UserClientMySQL, UserClientDynamo } = require('pp-dbapi/compat/user');
const { MerchantClientMySQL, MerchantClientDynamo } = require('pp-dbapi/compat/merchant');
const { LoanClientMySQL, LoanClientDynamo } = require('pp-dbapi/compat/loan');

/**************************************************************************************************/

function tbl_sort(tbl, orderspec) {
    const orderff = Array.from(orderspec);
    const collator = new Intl.Collator({}, { numeric: true });
    return Array.from(tbl).sort((a, b) => {
        for (const f of orderff) {
            const c = collator.compare(a[f], b[f]);
            if (c) return c;
        }
        return 0;
    });
    return result;
};

function obj_sort(obj) {
    return Object.keys(obj).sort().reduce((result, key) => ((result[key] = obj[key]), result), {});
};

async function dynamo_keys(tbl, ff) {
    let params = {
        ConsistentRead: true,
        TableName: tbl,
        //ProjectionExpression: ff, // говно, неэкранируемое по-простому
    };
    //console.log(params);
    let LastEvaluatedKey = null;
    const result = [];
    let r;
    do {
        let r = await dynamo.scan(params).promise();
        for (const row of r.Items ?? []) {
            let keys_row = {};
            for (const f of ff ?? Object.keys(row)) keys_row[f] = row[f];
            result.push(obj_sort(keys_row));
        }
        params.ExclusiveStartKey = r.LastEvaluatedKey;
    } while (params.ExclusiveStartKey);
    return result;
};

async function mysql_keys(tbl, ff, sql = null) {
    const result = await $tbl(sql ?? `
        SELECT ${Q(ff)}
        FROM ${Q(tbl)}
    `);
    return result.map(row => obj_sort(row));
}


/**************************************************************************************************/

const SCOPES = {
    user_query: {
        _keys_filter(keys_tbl) {
            return keys_tbl
                //.filter((keys_row) => ["details"].includes(keys_row.record))
                //.filter((keys_row) => ["status"].includes(keys_row.record))
                //.filter((keys_row) => ["customer"].includes(keys_row.record))
                //.filter((keys_row) => ["primary"].includes(keys_row.record))
                //.filter((keys_row) => ["settings"].includes(keys_row.record))
                //.filter((keys_row) => ["wallet"].includes(keys_row.record))
                //.filter((keys_row) => ["paymentMethod"].includes(keys_row.record))
                //.filter((keys_row) => keys_row.record.startsWith("paymentMethod"))
                //.filter((keys_row) => ["apns"].includes(keys_row.record))
                //.filter((keys_row) => [441235254, 123456789].includes(keys_row.user))
            ;
        },
        _keys_order(keys_tbl) {
            return tbl_sort(keys_tbl, ["user", "record"]);
        },
        async _test(adapter, keys_row) {
            let inst = new this[adapter].CLIENT(keys_row.user);
            let result = await inst.query(keys_row.record); // "details"
            return tbl_sort(result.Items.map(row => { /* delete row.batchXXXXXX; */ return obj_sort(row); }), ["user"]);
            //return [];
        },

        dynamo: {
            async _keys() {
                return dynamo_keys(process.env.userTable, ["user", "record"]);
            },
            CLIENT: UserClientDynamo,
        },

        mysql: {
            async _keys() {
                return mysql_keys(null, null, `
                    SELECT DISTINCT user, "status" as record FROM user_generic
                    UNION ALL
                    SELECT DISTINCT user, "customer" as record FROM user_generic
                    UNION ALL
                    SELECT DISTINCT user, "primary" as record FROM user_generic
                    UNION ALL
                    SELECT DISTINCT user, "recovery" as record FROM user_generic
                    UNION ALL
                    SELECT DISTINCT user, "details" as record FROM user_generic
                    UNION ALL
                    SELECT DISTINCT user, "settings" as record FROM user_generic
                    UNION ALL
                    SELECT DISTINCT user, "wallet" as record FROM user_wallet
                    UNION ALL
                    SELECT DISTINCT user, CONCAT("paymentMethod-", pmID) as record FROM user_paymeth
                    UNION ALL
                    SELECT DISTINCT user, "apns" as record FROM user_device_token
                `);
            },
            CLIENT: UserClientMySQL,
        },
    },

    merchant_query: {
        _keys_filter(keys_tbl) {
            return keys_tbl
                //.filter((keys_row) => ["_tSX9Ta_j3wRZ90dKiPGG"].includes(keys_row.merchant))
                //.filter((keys_row) => ["T5kaTT2tem6hFuyQ55bRp"].includes(keys_row.merchant))
                //.filter((keys_row) => ["details"].includes(keys_row.record))
                //.filter((keys_row) => ["user"].includes(keys_row.record))
            ;
        },
        _keys_order(keys_tbl) {
            return tbl_sort(keys_tbl, ["merchant", "record"]);
        },
        async _test(adapter, keys_row) {
            let inst = new this[adapter].CLIENT(keys_row.merchant);
            let result = await inst.query(keys_row.record); // "details"
            return tbl_sort(result.Items.map(row => { /* delete row.batchXXXXXX; */ return obj_sort(row); }), ["merchant"]);
            //return [];
        },

        dynamo: {
            async _keys() {
                return dynamo_keys(process.env.merchantTable, ["merchant", "record"]);
            },
            CLIENT: MerchantClientDynamo,
        },

        mysql: {
            async _keys() {
                return mysql_keys(null, null, `
                    SELECT DISTINCT merchant, "details" as record FROM merchant
                    UNION ALL
                    SELECT DISTINCT merchant, "user" as record FROM merchant_user
                    UNION ALL
                    SELECT DISTINCT merchant, _record as record FROM merchant_location
                    UNION ALL
                    SELECT DISTINCT merchant, CONCAT("product-", productID) as record FROM merchant_product
                    UNION ALL
                    SELECT DISTINCT merchant, CONCAT("productGroup-", productGroupID) as record FROM merchant_productgroup
                `);
            },
            CLIENT: MerchantClientMySQL,
        },
    },

    loan_query: {
        _keys_filter(keys_tbl) {
            return keys_tbl; //.filter((keys_row) => [447577573824, 447973758867].includes(keys_row.userID));
        },
        _keys_order(keys_tbl) {
            return tbl_sort(keys_tbl, ["userID", "loanStateID"]);
        },
        async _test(adapter, keys_row) {
            let inst = new this[adapter].CLIENT(keys_row.userID);
            let result = await inst.query(keys_row.loanStateID);
            return tbl_sort(result.Items.map(row => obj_sort(row)), ["userID", "loanStateID"]);
        },

        dynamo: {
            async _keys() {
                return dynamo_keys(process.env.loanTable, ["userID", "loanStateID"]);
            },
            CLIENT: LoanClientDynamo,
        },

        mysql: {
            async _keys() {
                return mysql_keys("loan", ["userID", "loanStateID"]);
            },
            CLIENT: LoanClientMySQL,
        },
    },

};



exports.main = async function main() {

    const [scope, adapter] = process.argv.slice(2);

    const SCOPE = SCOPES[scope];
    if (!SCOPE) {
        console.error(scope, "invalid scope; should be one of", Object.keys(SCOPES));
        return;
    }
    const valid_adapters = ["dynamo", "mysql"];
    if (!valid_adapters.includes(adapter)) {
        console.error(scope, "invalid adapter; should be one of", valid_adapters);
        return;
    }

    let keys_tbl = await SCOPE[adapter]._keys();
    if (SCOPE._keys_filter) keys_tbl = SCOPE._keys_filter(keys_tbl) ?? keys_tbl;
    if (SCOPE._keys_order) keys_tbl = SCOPE._keys_order(keys_tbl) ?? keys_tbl;
    //console.log(keys_tbl);
    //console.table(keys_tbl);

    for (const keys_row of keys_tbl) {
        let r = await SCOPE._test(adapter, keys_row);
        console.log(JSON.stringify(keys_row), r);
    }
};


Promise.resolve(exports.main()).then((r) => void (undefined === r || console.log({ "main return value": r })), console.error);

