const { lambda, expectLambdaFail } = require('./lambda');
const { testFunc } = require('./func');

const testAnd = (uri, rest, env) => {
    describe(`Parameter 'and' [ #and ]`, () => {
        it(`Fail on invalid value - object`, async function() {
            const r = await lambda(uri, { and: {}, ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on invalid value - string`, async function() {
            const r = await lambda(uri, { and: "STRING", ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on invalid value - empty OR`, async function() {
            const r = await lambda(uri, { and: [[]], ...rest }, this.test);
            expectLambdaFail(r);
        });
        it(`Fail on invalid value - string in OR`, async function() {
            const r = await lambda(uri, { and: [ [ "STRING" ] ], ...rest }, this.test);
            expectLambdaFail(r);
        });
        testFunc(uri, rest, env);
        testFunc(uri, rest, env, true);
    });
};

module.exports = { testAnd };
