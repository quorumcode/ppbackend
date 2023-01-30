const { expect } = require('./init');
const { lambda, expectLambdaFail } = require('./lambda');
const { isArray, Model } = require('pp-admin');

const testFields = (row, env, fields = []) => {
    if (!fields.length) fields = Object.keys(env.api2db);
    const rows = isArray(row) ? row : [ row ];
    rows.forEach((irow) => {
        fields.forEach((field) => {
            expect(irow, `${env.modelUri.toUpperCase()} row`).to.have.property(field);
            if (Model.ID === field) expect(irow, `${env.modelUri.toUpperCase()} row ID`).to.not.equal(null);
        });
    });
};

const testUriAbsent = (uri, rest, env) => {
    it(`Fail on url absent`, async function() {
        const r = await lambda(uri, rest, this.test);
        expectLambdaFail(r);
    });
};

module.exports = { testFields, testUriAbsent };
