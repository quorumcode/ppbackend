const { Response, Search, SqlTbl, User, Paymeth, Loan, LoanTrx, LoanItem, LoanCItem, Merchant } = require('pp-admin');

exports.lambda = async (request) => {
    try {
        const path = request.resource.replace(/\/{[_a-zA-Z0-9]+}/g, '').replace(/^\/v3\/admin/, '');
        const req = JSON.parse(request.body);
        let res;
        switch (path) {
// --- User
            case '/model/user/add':// create single user; req = { set{}, get[] }
                res = await User.add(req.set, req.get);
                break;
            case '/model/user/row':// get single user by ID; req = { id, get[] }
                res = await User.row(req.id, req.get);
                break;
            case '/model/user/upd':// update single user by ID; req = { id, set{}, get[] }
                res = await User.upd(req.id, req.set, req.get);
                break;
            case '/model/user/del':// delete single user by ID; req = { id }
                throw new Error('Delete user not implemented');
            //TODO await User.del(req.id);
            //TODO res = {};
            case '/model/user/tbl':// get users by filter; req = { id, and[{}], get[], order[[]], ofs, len }
                res = await User.tbl(req.get, req.and, req.order, req.ofs, req.len);
                break;
// === User
// --- Paymeth
            case '/model/paymeth/row':// get single user payment method by ID; req = { id, get[] }
                res = await Paymeth.row(req.id, req.get);
                break;
            case '/model/paymeth/tbl':// get user payment methods by filter; req = { id, and[{}], get[], order[[]], ofs, len }
                res = await Paymeth.tbl(req.get, req.and, req.order, req.ofs, req.len);
                break;
// === Paymeth
// --- Loan
            case '/model/loan/row':// get single loan by ID; req = { id, get[] }
                res = await Loan.row(req.id, req.get);
                break;
            case '/model/loan/tbl':// get loans by filter; req = { id, and[{}], get[], order[[]], ofs, len }
                res = await Loan.tbl(req.get, req.and, req.order, req.ofs, req.len);
                break;
            case '/model/loan/adj':// adjust loan transactions; req = { loan_id, apply, period, outstanding_amount, adjtrx[{}] }
                res = await Loan.adj(req.id, req.apply, req.period, req.outstanding_amount, req.adjtrx);
                break;
// === Loan
// --- LoanTrx
            case '/model/loantrx/row':// get single loan transaction by ID; req = { id, get[] }
                res = await LoanTrx.row(req.id, req.get);
                break;
            case '/model/loantrx/tbl':// get loan transactions by filter; req = { id, and[{}], get[], order[[]], ofs, len }
                res = await LoanTrx.tbl(req.get, req.and, req.order, req.ofs, req.len);
                break;
// === LoanTrx
// --- LoanItem
            case '/model/loanitem/row':// get single loan transaction by ID; req = { id, get[] }
                res = await LoanItem.row(req.id, req.get);
                break;
            case '/model/loanitem/tbl':// get loan transactions by filter; req = { id, and[{}], get[], order[[]], ofs, len }
                res = await LoanItem.tbl(req.get, req.and, req.order, req.ofs, req.len);
                break;
// === LoanItem
// --- LoanCItem
            case '/model/loancitem/row':// get single loan transaction by ID; req = { id, get[] }
                res = await LoanCItem.row(req.id, req.get);
                break;
            case '/model/loancitem/tbl':// get loan transactions by filter; req = { id, and[{}], get[], order[[]], ofs, len }
                res = await LoanCItem.tbl(req.get, req.and, req.order, req.ofs, req.len);
                break;
// === LoanCItem
// --- Merchant
            case '/model/merchant/row':// get single merchant by ID; req = { id, get[] }
                res = await Merchant.row(req.id, req.get);
                break;
            case '/model/merchant/tbl':// get merchants by filter; req = { id, and[{}], get[], order[[]], ofs, len }
                res = await Merchant.tbl(req.get, req.and, req.order, req.ofs, req.len);
                break;
// === Merchant
// --- Util
            case '/util/resend/email':// resend confirm letter to user email; req = { id, email }
                //TODO
                res = {};
                break;
            case '/util/verify/email':// verify user email; req = { id, email, code }
                //TODO
                throw new Error('Invalid verify');
                break;
            case '/util/resend/phone':// resend confirm SMS to user phone; req = { id, phone }
                //TODO
                res = {};
                break;
            case '/util/verify/phone':// verify user phone; req = { id, phone, code }
                //TODO
                throw new Error('Invalid verify');
                break;
            case '/util/search':// search; req = { text, models{} }
                res = await Search.exec(req.text, req.models);
                break;
            case '/util/sqltbl':// search; req = { sql }
                res = await SqlTbl.exec(req.sql);
                break;
// === Util
/*
            // the uri schema is not stable, the following are just a first-glance suggestions

            // an example for entity search/select using some kind of filtering conditions:
            // case '/query': // (FYI ONLY, NOT ABOUT TO BE IMPLEMENTED) generic mixtype object search
            // case '/query/{obj}': // FYI: URI reference
            case '/query/user': // search/select user(s); params: q (fulltext search), user_id, user_phone, user_name, ...
                res = await require("./query.js").user(req);
                break;

            case '/query/merchant': // search/select merchant(s) ("marketplace(s)" in fact); params: q (fulltext search), merchant_id, merchant_name, ...
                res = await require("./query.js").merchant(req);
                break;

            case '/query/loan': // search/select loan(s); params: q (fulltext search), user_id, trx_id, merchant_id, merchant_name, ..., ..., ...
                res = await require("./query.js").loan(req);
                break;

            // an example for 2d+ tabular data requests:
            // case '/view/{type}': // (may be treated as a wrappers for SQL views with optional row/col filtering and specific sort conditions)
            // case '/view/sysstat': // generic system status (user count, etc) and/or health reports
            // case '/view/overdue': // overdue report
            // case '/view/...':
            //     throw new Error('Not implemented.')

            // an example for uncategorized functionality:
            // case '/util/s3/upload': // manual file(s) upload, unrelated to any entity, DB data should be updated separately using e.g. /model/.../set
            // case '/util/s3/...': // (reference/example only) any kind of s3 manipulation
            // case '/util/...':
            //    throw new Error('Not implemented.')
*/
            default:
                throw new Error(`Invalid path '${path}'`);
        }

    // If res undefined, than return 404
        if ("undefined" === typeof res) {
            return Response.reject(request, "Not found", 404);
        }

    // Else return success response
        return Response.resolve(request, res);
    }
    catch (err) {
        if ((!request.headers) || (!request.headers['test'])) console.error(err);
        return Response.reject(request, err.toString());
    }
};
