const { LEN } = require('./init');
const { lambda, expectLambdaFail, expectLambdaOKTbl, expectLambdaOKSearch, refillConstObj } = require('./lambda');
const { testFields } = require('./other');
const { Model } = require('pp-admin');

const testOfs = (uri, rest, env, lambdabody, tblobj) => {

// Object for call lambda
    if (!lambdabody) lambdabody = {};

// Object for put ofs inside
    if (!tblobj) tblobj = lambdabody;

    describe(`Parameter 'ofs' [ #ofs ]`, () => {
        it(`Fail on not number`, async function() {
            refillConstObj(tblobj, { ofs: "NOT NUMBER", ...rest });
            const r = await lambda(uri, lambdabody, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on < 0`, async function() {
            refillConstObj(tblobj, { ofs: -1, ...rest });
            const r = await lambda(uri, lambdabody, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on >= ${Model.MAXLEN}`, async function() {
            refillConstObj(tblobj, { ofs: Model.MAXLEN, ...rest });
            const r = await lambda(uri, lambdabody, this.test);
            expectLambdaFail(r);
        });
        it(`=1`, async function() {
            refillConstObj(tblobj, { ofs: 1, ...rest, len: LEN });
            const r = await lambda(uri, lambdabody, this.test);
            if (lambdabody !== tblobj) expectLambdaOKSearch(r, env.modelUri, lambdabody.text.trim());
            else {
                expectLambdaOKTbl(r, LEN);
                testFields(r.body.res.body, env);
            }
        });
    });
};

module.exports = { testOfs };
