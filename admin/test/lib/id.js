const { lambda, expectLambdaFail, expectLambdaNotFound } = require('./lambda');
const { isArray, FIELD, Model } = require('pp-admin');

const testID = (uri, rest, env) => {
    describe(`Parameter 'id' [ #id ]`, () => {
        it(`Fail on absent`, async function() {
            const r = await lambda(uri, { ...rest }, this.test);
            expectLambdaFail(r);
        });

        it(`Not found ID`, async function() {
            const r = await lambda(uri, { [Model.ID]: env.almostValidID, ...rest }, this.test);
            expectLambdaNotFound(r);
        });

        if (isArray(env.api2db[Model.ID][FIELD.DBFIELD] ?? false)) {
            it(`Fail on invalid ID`, async function() {
                const r = await lambda(uri, { id: "NOTFOUND_MODEL_ROW", ...rest }, this.test);
                expectLambdaFail(r);
            });
        }
    });
};

module.exports = { testID };
