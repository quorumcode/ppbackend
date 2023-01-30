const { LEN, expect } = require('./init');
const { lambda, expectLambdaOKTbl } = require('./lambda');
const { testFields } = require('./other');
const { Model } = require('pp-admin');

const getTbl = (name, get, fields, env) => {
    it(`${name}, len=${LEN}`, async function() {
        const r0 = await lambda(env.uriTbl, { get, len: LEN }, this.test);
        expectLambdaOKTbl(r0, LEN);
        const tbl0 = r0.body.res.body;
        testFields(tbl0, env, fields);
        const r1 = await lambda(env.uriTbl, { get, len: LEN - 1, ofs: 1 }, this.test);
        expectLambdaOKTbl(r1, LEN);
        const tbl1 = r1.body.res.body;
        testFields(tbl1, env, fields);
        tbl1.forEach((row, i) => {
            expect(row, `Item ${i} with ofs=1`).to.deep.equal(tbl0[i + 1]);
        });
    });
};

const testTbl = (uri, rest, env) => {
    describe(`Get table [ #gettbl ]`, () => {
        getTbl(`Get full`, [], Object.keys(env.api2db), env);
        Object.keys(env.api2db).forEach((field) => {
            getTbl(`Get only ${field}`, [ field ], [Model.ID, field], env);
        });
    });
};

module.exports = { testTbl };
