const { LEN } = require('./init');
const { lambda, expectLambdaFail, expectLambdaOKTbl } = require('./lambda');
const { testFields } = require('./other');
const { FUNC, Model } = require('pp-admin');

const testFunc = (uri, rest, env, or = false) => {
    const inor = or ? ' in OR' : '';
    describe(`Function${inor} [ #func ]`, () => {
        it(`Fail on empty condition${inor}`, async function() {
            const func = {};
            const r = await lambda(uri, { and: [ or ? [ func ] : func ], ...rest }, this.test);
            expectLambdaFail(r);
        });

        it(`Fail on no value${inor}`, async function() {
            const func = or ? [{ fld: Model.ID }] : { fld: Model.ID };
            const r = await lambda(uri, { and: [ or ? [ func ] : func ], ...rest }, this.test);
            expectLambdaFail(r);
        });

        it(`Fail on not array in 'arr'${inor}`, async function() {
            const func = { fld: Model.ID, arr: "Not array" };
            const r = await lambda(uri, { and: [ or ? [ func ] : func ], ...rest }, this.test);
            expectLambdaFail(r);
        });

        it(`Fail on unknown field${inor}`, async function() {
            const func = { fld: "UNKNOWN_FIELD", val: 0 };
            const r = await lambda(uri, { and: [ or ? [ func ] : func ], ...rest }, this.test);
            expectLambdaFail(r);
        });

        it(`Fail on unknown function${inor}`, async function() {
            const func = { fld: Model.ID, val: env.almostValidID, func: "UNKNOWN_FUNC" };
            const r = await lambda(uri, { and: [ or ? [ func ] : func ], ...rest }, this.test);
            expectLambdaFail(r);
        });

        it(`id=almostValidID`, async function() {
            const func = { fld: Model.ID, val: env.almostValidID, func: FUNC.EQ };
            const and = or ? [ [ func, func ] ] : [ func, func ];
            const r = await lambda(uri, { and, ...rest, len: LEN }, this.test);
            expectLambdaOKTbl(r, LEN);
            testFields(r.body.res.body, env);
        });

        it(`id in [almostValidID]`, async function() {
            const func = { fld: Model.ID, arr: [ env.almostValidID ], func: FUNC.EQ };
            const and = or ? [ [ func, func ] ] : [ func, func ];
            const r = await lambda(uri, { and, ...rest, len: LEN }, this.test);
            expectLambdaOKTbl(r, LEN);
            testFields(r.body.res.body, env);
        });
    });
}

module.exports = { testFunc };
