const { LEN, expect } = require('./init');
const { lambda, expectLambdaOKSearch, expectLambdaFail } = require('./lambda');
const { testFields } = require('./other');
const { isEmptyObject, Model } = require('pp-admin');
const { testGet } = require('./get');
const { testOfs } = require('./ofs');
const { testLen } = require('./len');

const TEXT = 'SOME TEXT FOR SEARCH';

const validSearch = (uriSearch, name, search, env) => {
    it(`${name}`, async function() {
        const r = await lambda(uriSearch, { text: `  ${TEXT}  `, models: { [env.modelUri]: { get: [], search } } }, this.test);
        expectLambdaOKSearch(r, env.modelUri, TEXT);
    });
};

const failSearch = (uriSearch, name, search, env) => {
    it(`${name}`, async function() {
        const r = await lambda(uriSearch, { text: `  ${TEXT}  `, models: { [env.modelUri]: { get: [], search } } }, this.test);
        expectLambdaFail(r, env.modelUri, TEXT);
    });
};

const testSearch = (uriSearch, rest, env) => {
    const searchFields = Object.keys(env.search ?? {});
    const modelFields = Object.keys(env.api2db);
    describe(`Fail on searching`, () => {
        if (!searchFields.length) {
            failSearch(uriSearch, `Fail search full`, undefined, env)
        }
        if (modelFields.length !== searchFields.length) {
            modelFields.forEach((field) => {
                if (searchFields.includes(field)) return;
                failSearch(uriSearch, `Fail search in field '${field}'`, [field], env)
            });
        }
    });
    if (searchFields.length) {
        describe(`Valid searching`, () => {
            validSearch(uriSearch, `Search full`, undefined, env);
            searchFields.forEach((field) => {
                validSearch(uriSearch, `Search only in ${field}`, [field], env);
            });
            const lambdabody = { text: `  ${TEXT}  `, models: { [env.modelUri]: {} } };
            const tblobj = lambdabody.models[env.modelUri];
            testGet(uriSearch, {}, env, lambdabody, tblobj);
            testLen(uriSearch, { get: [] }, env, lambdabody, tblobj);
            testOfs(uriSearch, { get: [] }, env, lambdabody, tblobj);
        });
    }
};

module.exports = { testSearch };
