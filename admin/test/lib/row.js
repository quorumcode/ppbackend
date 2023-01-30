const { lambda, expectLambdaOKTbl, expectLambdaOKRow } = require('./lambda');
const { testFields } = require('./other');
const { Model } = require('pp-admin');

const getRow = (name, get, fields, env) => {
    it(name, async function() {
        const rtbl = await lambda(env.uriTbl, { get:[ Model.ID ], len: 1 }, this.test);
        expectLambdaOKTbl(rtbl, 1);
        testFields(rtbl.body.res.body, env, [ Model.ID ]);
        const { id } = rtbl.body.res.body[0];

        if (id) {
            const r = await lambda(env.uriRow, { [Model.ID]: id, get }, this.test);
            expectLambdaOKRow(r);
            testFields(r.body.res, env, fields);
        }
        else console.log(`Now rows for ${env.modelUri}`);
    });
};

const testRow = (uri, rest, env) => {
    describe(`Get row [ #getrow ]`, () => {
        getRow(`Get full`, [], Object.keys(env.api2db), env);
        Object.keys(env.api2db).forEach((field) => {
            getRow(`Get only ${field}`, [ field ], [Model.ID, field], env);
        });
    });
};

module.exports = { testRow };
