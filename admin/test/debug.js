process.env.MYSQLCFG = 'mysql://root@mysql-local/v201-debug-mock?socketPath=tmp/mysql/mysql.sock';

const { lambda } = require('../api/index');

(async function() {

    const logdata = (data) => {
        if (!data.body) console.log(data);
        else {
            const body = JSON.parse(data.body);
            console.log(JSON.stringify(body, null, 2));
        }
    };

/*
    console.log('user/row id=447498164083');
    await lambda({
        resource: '/v3/admin/model/user/row',
        body: JSON.stringify({ id: 447498164083, get: [] }),
    }).then((data) => logdata(data));

    console.log('user/tbl id=447498164083');
    await lambda({
        resource: '/v3/admin/model/user/tbl',
        body: JSON.stringify({
            and: [
                { fld: "id", val: 447498164083 },
            ],
            get: [
            // 'passport_identity_id', 'passport_verification_id',
            // 'address_identity_id', 'address_verification_id',
        ]}),
    }).then((data) => logdata(data));

    console.log('user/tbl (loans_latest_dt>=2022-06-01)and(loans_latest_dt<=2022-07-01)');
    await lambda({
        resource: '/v3/admin/model/user/tbl',
        body: JSON.stringify({
            and: [
                { fld: "loans_latest_dt", func: 'gte', val: '2022-06-01' },
                { fld: "loans_latest_dt", func: 'lte', val: '2022-07-01' },
            ],
            get:[ 'loans_latest_dt', "name_first", "name_last" ]}),
    }).then((data) => logdata(data));

    console.log('user/tbl');
    await lambda({
        resource: '/v3/admin/model/user/tbl',
        body: JSON.stringify({
            get:[ "name_first", "name_last", "address_status", "address_identity_id", "address_verification_id"]}),
    }).then((data) => logdata(data));

    console.log('search "Oscar 4475"');
    await lambda({
        resource: '/v3/admin/util/search',
        body: JSON.stringify({
            text: "Oscar 4475",
            models: {
                user: {
                    get: ['name_first', 'name_middle', 'name_last'],
                },
            },
        }),
    }).then((data) => logdata(data));

    console.log('paymeth/tbl user_id=123456789');
    await lambda({
        resource: '/v3/admin/model/paymeth/tbl',
        body: JSON.stringify({ and:[{ fld: 'user_id', val: 123456789}], get: []}),
    }).then((data) => logdata(data));

    console.log('loan/tbl');
    await lambda({
        resource: '/v3/admin/model/loan/tbl',
        body: JSON.stringify({
            and: [ {fld: 'outstanding', val: 1 } ],
            get: [ 'outstanding_amount',
                'next_payment_dt', 'next_payment_amount',
                'last_payment_dt', 'last_payment_amount',
                'first_payment_dt', 'first_payment_amount', 'first_payment_status',
            ],
            len: 100,
        }),
    }).then((data) => logdata(data));
*/
    console.log('loan/row');
    await lambda({
        resource: '/v3/admin/model/loan/row',
        body: JSON.stringify({
            id: 174,
            get: [],
        }),
    }).then((data) => logdata(data));

    console.log('loantrx/tbl');
    await lambda({
        resource: '/v3/admin/model/loantrx/tbl',
        body: JSON.stringify({
            and: [ {fld: 'loan_id', val: 174 } ],
            get:[], len: 10
        }),
    }).then((data) => logdata(data));

    console.log('loan/adj');
    await lambda({
        resource: '/v3/admin/model/loan/adj',
        body: JSON.stringify({
            id: 174,
            apply: 1,
            period: 'fortnightly',
            outstanding_amount: 18,
        }),
    }).then((data) => logdata(data));

    console.log('loan/adj');
    await lambda({
        resource: '/v3/admin/model/loan/adj',
        body: JSON.stringify({
            id: 174,
            period: 'monthly',
            outstanding_amount: 10.11,
        }),
    }).then((data) => logdata(data));
/*
    console.log('loantrx/row');
    await lambda({
        resource: '/v3/admin/model/loantrx/row',
        body: JSON.stringify({id: "[1, 2]", get:[] }),
    }).then((data) => logdata(data));

    console.log('loanitem/row');
    await lambda({
        resource: '/v3/admin/model/loanitem/row',
        body: JSON.stringify({id: "[8, 1]", get:[]}),
    }).then((data) => logdata(data));

    console.log('loanitem/tbl');
    await lambda({
        resource: '/v3/admin/model/loanitem/tbl',
        body: JSON.stringify({get:[], len: 10}),
    }).then((data) => logdata(data));

    console.log('loancitem/row');
    await lambda({
        resource: '/v3/admin/model/loancitem/row',
        body: JSON.stringify({id: "[38, 1]", get:[]}),
    }).then((data) => logdata(data));

    console.log('loancitem/tbl');
    await lambda({
        resource: '/v3/admin/model/loancitem/tbl',
        body: JSON.stringify({get:[], len: 10}),
    }).then((data) => logdata(data));

    console.log('util/sqltbl');
    await lambda({
        resource: '/v3/admin/util/sqltbl',
        body: JSON.stringify({ sql: "SELECT name FROM `user_generic`"}),
    }).then((data) => logdata(data));
*/
})();
