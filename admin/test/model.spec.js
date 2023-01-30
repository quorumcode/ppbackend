const { logfailed } = require('./lib/lambda');
const { testID } = require('./lib/id');
const { testGet } = require('./lib/get');
const { testSet } = require('./lib/set');
const { testAnd } = require('./lib/and');
const { testOrder } = require('./lib/order');
const { testOfs } = require('./lib/ofs');
const { testLen } = require('./lib/len');
const { testTbl } = require('./lib/tbl');
const { testRow } = require('./lib/row');
const { testUriAbsent } = require('./lib/other');
const { testSearch } = require('./lib/search');

const { isArray, FIELD, Model, User, Paymeth, Loan, LoanTrx, LoanItem, LoanCItem, Merchant } = require('pp-admin');

describe('PP Admin API [ #admin #api ]', () => {
    afterEach(function() {
        logfailed(this.currentTest);
    });
    const models = {
        'user': User,
        'paymeth': Paymeth,
        'loan': Loan,
        'loantrx': LoanTrx,
        'loanitem': LoanItem,
        'loancitem': LoanCItem,
        'merchant': Merchant,
    };
    Object.keys(models).forEach((modelUri) => {
        const uriTbl = `/v3/admin/model/${modelUri}/tbl`;
        const uriRow = `/v3/admin/model/${modelUri}/row`;
        const uriUpd = `/v3/admin/model/${modelUri}/upd`;
        const uriAdd = `/v3/admin/model/${modelUri}/add`;

        const { api2db, search } = models[modelUri];

    // Create almost "valid" parameter 'id'
        const almostValidID = isArray(api2db[Model.ID][FIELD.DBFIELD] ?? false) ?
            JSON.stringify(Array(api2db[Model.ID][FIELD.DBFIELD].length).fill("almostValidID")) : "almostValidID";

    // Create almost "valid" parameter 'set'
        const almostValidSet = {};
        Object.keys(api2db).forEach((field) => {
            if (Model.ID === field) return;
            const mode = api2db[field][FIELD.MODE] ?? FIELD.MODE_DB;
            if (([FIELD.MODE_DB, FIELD.MODE_PATCH].includes(mode)) &&
                (!api2db[field][FIELD.READONLY])) almostValidSet[field] = "SOMEVALUE";
        });

    // Environment for tests
        const env = {modelUri, api2db, search, almostValidID, almostValidSet, uriRow, uriTbl, uriUpd, uriAdd};

        describe(`${modelUri.toUpperCase()} [ #model #${modelUri} ]`, () => {

            describe(`TBL - read few rows [ #tbl ]`, () => {
                const rest = { get: [] };

                testGet(uriTbl, {}, env);
                testAnd(uriTbl, rest, env);
                testOrder(uriTbl, rest, env);
                testOfs(uriTbl, rest, env);
                testLen(uriTbl, rest, env);
                testTbl(uriTbl, {}, env);
            });

            describe(`ROW - read one row [ #row ]`, () => {
                testID(uriRow, { get: [] }, env);
                testGet(uriRow, { [Model.ID]: almostValidID }, env);
                testRow(uriRow, {}, env);
            });

            describe(`UPD - update one row [ #upd ]`, () => {
            // Models with update
                if (['user'].includes(modelUri)) {
                    testID(uriUpd, { get: [], set: almostValidSet }, env);
                    testGet(uriUpd, { [Model.ID]: almostValidID, set: almostValidSet }, env);
                    testSet(uriUpd, { [Model.ID]: almostValidID, get: [] }, env);
                }
                else {
                    testUriAbsent(uriUpd, { [Model.ID]: almostValidID, set: almostValidSet, get: [] }, env);
                }
            });

            describe(`ADD - create one row [ #add ]`, () => {
            // Models with create
                if (['user'].includes(modelUri)) {
                    testGet(uriAdd, { set: almostValidSet }, env);
                    testSet(uriAdd, { get: [] }, env);
                }
                else {
                    testUriAbsent(uriAdd, { set: almostValidSet, get: [] }, env);
                }
            });

        // Model with search
            describe(`SEARCH - find rows by text [ #search ]`, () => {
                testSearch('/v3/admin/util/search', {}, env);
            });
        });
    });
});
