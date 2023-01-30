const { lambda, expectLambdaFail, expectLambdaOKTbl, expectLambdaOKSearch, refillConstObj } = require('./lambda');
const { testFields } = require('./other');
const { Model } = require('pp-admin');

const testLen = (uri, rest, env, lambdabody, tblobj) => {

// Object for call lambda
    if (!lambdabody) lambdabody = {};

// Object for put len inside
    if (!tblobj) tblobj = lambdabody;

    describe(`Parameter 'len' [ #len ]`, () => {
        it(`Fail on <= 0`, async function() {
            refillConstObj(tblobj, { len: 0, ...rest });
            const r = await lambda(uri, lambdabody, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on > ${Model.MAXLEN}`, async function() {
            refillConstObj(tblobj, { len: Model.MAXLEN + 1, ...rest });
            const r = await lambda(uri, lambdabody, this.test);
            expectLambdaFail(r);
        });
        it(`=1`, async function() {
            refillConstObj(tblobj, { len: 1, ...rest });
            const r = await lambda(uri, lambdabody, this.test);
            if (lambdabody !== tblobj) expectLambdaOKSearch(r, env.modelUri, lambdabody.text.trim());
            else {
                expectLambdaOKTbl(r, 1);
                testFields(r.body.res.body, env);
            }
        });
    });
};

module.exports = { testLen };
