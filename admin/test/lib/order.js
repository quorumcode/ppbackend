const { LEN } = require('./init');
const { lambda, expectLambdaFail, expectLambdaOKTbl } = require('./lambda');
const { testFields } = require('./other');
const { Model } = require('pp-admin');

const testOrder = (uri, rest, env) => {
    describe(`Parameter 'order' [ #order ]`, () => {
        it(`Fail on invalid value - object`, async function() {
            const r = await lambda(uri, { order: {}, ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on invalid value - string`, async function() {
            const r = await lambda(uri, { order: "STRING", ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on invalid value - empty array`, async function() {
            const r = await lambda(uri, { order: [ [] ], ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on unknown field`, async function() {
            const r = await lambda(uri, { order: [ [ "UNKNOWN FIELD" ] ], ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on invalid type`, async function() {
            const r = await lambda(uri, { order: [ [ {} ] ], ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on unknown sort`, async function() {
            const r = await lambda(uri, { order: [ [ Model.ID, "UNKNOWN SORT" ] ], ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on many items`, async function() {
            const r = await lambda(uri, { order: [ [ Model.ID, "ASC", "INVALID ITEM" ] ], ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on many orders`, async function() {
            const r = await lambda(uri, { order: Array(Model.MAXORDERS + 1).fill([ Model.ID ]), ...rest }, this.test);
            expectLambdaFail(r);
        });
        Object.keys(env.api2db).forEach((field) => {
            it(`${field} ASC`, async function() {
                const r = await lambda(uri, { order: [ [ field, "ASC" ] ], ...rest, len: LEN }, this.test);
                expectLambdaOKTbl(r, LEN);
                testFields(r.body.res.body, env);
            });
            it(`${field} DESC`, async function() {
                const r = await lambda(uri, { order: [ [ field, "DESC" ] ], ...rest, len: LEN }, this.test);
                expectLambdaOKTbl(r, LEN);
                testFields(r.body.res.body, env);
            });
        });
    });
};

module.exports = { testOrder };
