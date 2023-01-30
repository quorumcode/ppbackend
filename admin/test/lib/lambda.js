const { expect } = require('./init');
const { lambda } = require('../../api/index');
const { isString } = require('pp-admin');

const lambdaResult = 'Lambda result';
const lambdaResultStatusCode = `${lambdaResult}.statusCode`;
const lambdaResultHeaders = `${lambdaResult}.headers`;
const lambdaResultBody = `${lambdaResult}.body`;
const lambdaResultBodyErr = `${lambdaResultBody}.err`;
const lambdaResultBodyRes = `${lambdaResultBody}.res`;
const lambdaResultBodyRej = `${lambdaResultBody}.rej`;
const lambdaResultBodyRejMessage = `${lambdaResultBodyRej}.message`;
const lambdaResultBodyRejCode = `${lambdaResultBodyRej}.code`;

const expectLambda = (r, mustCode = null, mustErr = null) => {

    expect(r, lambdaResult).to.be.a('object');
    expect(r, lambdaResult).to.have.property('statusCode');
    expect(r, lambdaResult).to.have.property('headers');
    expect(r, lambdaResult).to.have.property('body');

    const { statusCode, headers } = r;

    expect(r.body, lambdaResultBody).to.be.a('string');

    try {
        r.body = JSON.parse(r.body);
    } catch {
        expect.fail(`${lambdaResultBody} must be valid JSON`);
    }

    const { body } = r;
    expect(body, lambdaResultBody).to.have.property('err');

    if (null === mustCode) expect(statusCode, lambdaResultStatusCode).to.be.a('number');
    else expect(statusCode, lambdaResultStatusCode).to.be.equal(mustCode);

// Check CORS headers
    expect(headers, lambdaResultHeaders).to.be.a('object');
    expect(headers, lambdaResultHeaders).to.have.property('Access-Control-Allow-Origin');
    expect(headers, lambdaResultHeaders).to.have.property('Access-Control-Allow-Methods');
    expect(headers, lambdaResultHeaders).to.have.property('Access-Control-Allow-Headers');
    expect(headers, lambdaResultHeaders).to.have.property('Access-Control-Allow-Credentials');

    if (null === mustErr) expect(body.err, lambdaResultBodyErr).to.be.a('boolean');
    else {
        expect(body.err, lambdaResultBodyErr).to.be.equal(mustErr);
        if (mustErr) {
            expect(body, lambdaResultBody).to.not.have.property('res');
            expect(body, lambdaResultBody).to.have.property('rej');
        }
        else {
            expect(body, lambdaResultBody).to.have.property('res');
            expect(body, lambdaResultBody).to.not.have.property('rej');
        }
    }
};

const expectLambdaOK = (r) => {
    expectLambda(r, 200, false);
};

const expectLambdaOKRow = (r) => {
    expectLambdaOK(r);
    expect(r.body.res, lambdaResultBodyRes).to.be.a('object');
};

const expectLambdaOKTbl = (r, mustLen = null) => {
    expectLambdaOK(r);
    const { res } = r.body;
    expect(res, lambdaResultBodyRes).to.be.a('object');
    expect(res, lambdaResultBodyRes).to.have.property('body');
    expect(res.body, `${lambdaResultBodyRes}.body`).to.be.a('array');
    if (null !== mustLen) {
        // If no data in databse, length can be less mustLen
        expect(res.body, `${lambdaResultBodyRes}.body`).to.have.lengthOf.at.most(mustLen);
    }
};

const expectLambdaOKSearch = (r, model, musttext) => {
    expectLambdaOK(r);
    const { res } = r.body;
    expect(res, lambdaResultBodyRes).to.be.a('object');
    expect(res, lambdaResultBodyRes).to.have.property('text');
    const { text, models } = res;
    expect(text, `${lambdaResultBodyRes}.text`).to.be.a('string');
    if (musttext) expect(text, `${lambdaResultBodyRes}.text`).to.be.equal(musttext);
    expect(res, lambdaResultBodyRes).to.have.property('models');
    expect(models, `${lambdaResultBodyRes}.models`).to.be.a('object');
    expect(models, `${lambdaResultBodyRes}.models`).to.have.property(model);
    expect(models[model], `${lambdaResultBodyRes}.models.${model}`).to.be.a('object');
    expect(models[model], `${lambdaResultBodyRes}.models.${model}`).to.have.property('body');
    expect(models[model].body, `${lambdaResultBodyRes}.models.${model}.body`).to.be.a('array');
};

const expectLambdaErr = (r, mustCode = null, mustMessage = null) => {
    expectLambda(r, mustCode, true);
    const { rej } = r.body;
    expect(rej, lambdaResultBodyRej).to.be.a('object');
    expect(rej, lambdaResultBodyRej).to.have.property('message');
    expect(rej, lambdaResultBodyRej).to.have.property('code');

    const { message, code } = rej;
    expect(message, lambdaResultBodyRejMessage).to.be.a('string');

    if (null === mustCode) expect(code, lambdaResultBodyRejCode).to.be.a('number');
    else expect(code, lambdaResultBodyRejCode).to.be.equal(mustCode);
};

const expectLambdaFail = (r) => {
    expectLambdaErr(r, 400);
};

const expectLambdaNotFound = (r) => {
    expectLambdaErr(r, 404);
};

const logfailed = (test) => {
    if ('passed' === test.state) return;
    const { req, res } = test;
    if (("object" === typeof req) && (req['headers'])) delete req['headers'];
    if (("object" === typeof res) && (res['headers'])) delete res['headers'];
    try {
        if (isString(req.body)) req.body = JSON.parse(req.body);
    }
    catch {}
    try {
        if (isString(res.body)) res.body = JSON.parse(res.body);
    }
    catch {}
    test.err.stack += `\n\n--->\n${JSON.stringify(req, null, 2)}\n<---\n${JSON.stringify(res, null, 2)}`;
};

const refillConstObj = (obj, fillobj) => {
    Object.keys(obj).forEach((f) => delete obj[f]);
    Object.keys(fillobj).forEach((f) => obj[f] = fillobj[f]);
};

module.exports = {
    expectLambdaOK,
    expectLambdaOKRow,
    expectLambdaOKTbl,
    expectLambdaOKSearch,
    expectLambdaErr,
    expectLambdaFail,
    expectLambdaNotFound,
    logfailed,
    refillConstObj,
};

module.exports.lambda = async function(uri, body, test) {
    const req = {
        resource: uri,
        body: JSON.stringify(body),
        headers: { 'test': 'test' },
    };
    const r = await lambda(req);
    test.req = req;
    test.res = r;
    return r;
};
