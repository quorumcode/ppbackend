// console patchwork
Object.assign(require("util").inspect.defaultOptions, {
    depth: 5,
    colors: true,
});

//const AWS = require('aws-sdk');
//const dynamo = new AWS.DynamoDB.DocumentClient(require('aws-layer/dynamo/cfg'));

const mysql_client = require('pp-mysql/client');
const {
    Q, q, qlike,
    $tbl,
    $col,
    $row,
    $one,
} = mysql_client.shorthands();


/**************************************************************************************************/


exports.main = async function main() {

    const { PPClientApi } = require('../pp-client');
    let ppc = new PPClientApi();

    //let r = await https_request(cfg, { method: "GET", path: "/listcategories" });
    //let r = await https_request(cfg, { path: "/listcategories" });

    //let r = await ppc._call("GET", "/listcategories");

    //let r = await ppc.getmerchants();
    //let r = await ppc.categories();
    //let r = await ppc.categories(11);
    //let r = await ppc.categories("Automotive");


    //let r = await $tbl("SELECT FROM_UNIXTIME(1650898792.231) as t0, concat('', FROM_UNIXTIME(1650898792.231)) as t1");
    //r[0].t2 = new Date(1650898792231);
    //r[0].t3 = (new Date(1650898792231)).toTimeString();

    //const { UserClientMySQL: UserClient } = require('pp-dbapi/compat/user');
    //const { MerchantClientMySQL: MerchantClient, MerchantClientDynamo } = require('pp-dbapi/compat/merchant');
    //const { LoanClientMySQL, LoanClientDynamo } = require('pp-dbapi/compat/loan');

    //const uc = new UserClient(123456789);
    //let r = await uc.query("wallet");
    //let r = await uc.paymentMethod();
    //let r = await uc.customer();
    let r = await uc.apns();

    //console.table(r);
    console.log({ r });

};


Promise.resolve(exports.main()).then((r) => void (undefined === r || console.log(r)), console.error);

