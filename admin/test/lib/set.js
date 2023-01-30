const { lambda, expectLambdaFail } = require('./lambda');
const { FIELD, Model } = require('pp-admin');

const testSet = (uri, rest, env) => {
    describe(`Parameter 'set' [ #set ]`, () => {
        it(`Fail on absent`, async function() {
            const r = await lambda(uri, { ...rest }, this.test);
            expectLambdaFail(r);
        });

        it(`Fail on unknown field`, async function() {
            const r = await lambda(uri, { set: { "UNKNOWN FIELD" : 0 }, ...rest }, this.test);
            expectLambdaFail(r);
        });

        const { api2db } = env;
        Object.keys(api2db).forEach((field) => {
            const mode = api2db[field][FIELD.MODE] ?? FIELD.MODE_DB;
            if ((Model.ID === field) ||
                (![FIELD.MODE_DB, FIELD.MODE_PATCH].includes(mode)) ||
                (api2db[field][FIELD.READONLY])
            ) {
                it(`Fail on set readonly ${field}`, async function() {
                    const r = await lambda(uri, { set: { [field]: "SOMEVALUE" }, ...rest }, this.test);
                    expectLambdaFail(r);
                });
            }
        });
    });
};

module.exports = { testSet };
