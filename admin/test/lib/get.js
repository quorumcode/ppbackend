const { lambda, expectLambdaFail, refillConstObj } = require('./lambda');

const testGet = (uri, rest, env, lambdabody, getobj) => {

// Object for call lambda
    if (!lambdabody) lambdabody = {};

// Object for put get inside
    if (!getobj) getobj = lambdabody;

    describe(`Parameter 'get' [ #get ]`, () => {
        it(`Fail on absent`, async function() {
            refillConstObj(getobj, { ...rest });
            const r = await lambda(uri, lambdabody, this.test);
            expectLambdaFail(r);
        });

        it(`Fail on unknown field`, async function() {
            refillConstObj(getobj, { get: ["UNKNOWN"], ...rest });
            const r = await lambda(uri, lambdabody, this.test);
            expectLambdaFail(r);
        });
    });
};

module.exports = { testGet };
