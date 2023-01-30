(function() {


const http = require("http");
const https = require("https");


const CFG_DEFAULT = {
    // v2-production
    //base: "https://iuelkuude2.execute-api.eu-west-2.amazonaws.com/stage"

    // v201-debug-test
    //base: "https://q5ibv6w5cj.execute-api.eu-west-2.amazonaws.com/stage",

    // local
    base: "http://192.168.1.9:3000/",

    //endpoint: {
    //    hostname: '09xroanhbf.execute-api.eu-west-2.amazonaws.com',
    //    port: 443,
    //    path: '/stage',
    //    //method: 'GET',
    //}
};

module.exports.CFG_DEFAULT = CFG_DEFAULT;



class PPClientApi {
    constructor(cfg = CFG_DEFAULT) {
        let url = new URL(cfg.base);
        let url_protocol = url.protocol || "https:";
        this.cfg = {
            //protocol: url_protocol,
            adapter: { "http:": http, "https:": https }[url_protocol],
            host: url.hostname, //'09xroanhbf.execute-api.eu-west-2.amazonaws.com',
            port: url.port, // || { "http:": 80, "https:": 443 }[url_protocol] || 443,
            path: url.pathname, //"/stage",
        };
    };

    async _call(meth, path, payload) {
        const { cfg } = this;
        const opts = {
            host: cfg.host,
            port: cfg.port, // ?? 443,
            path: cfg.path + path,
            method: meth ?? "GET",
            headers: {
                //"Host": "...",
                //"User-Agent": '...',
                //"Content-Type": "application/json",
                //"Content-Length": ...
            },
        };

        let req_body; // undefined
        if (payload) {
            req_body = JSON.stringify(payload);
            opts.headers["Content-Type"] = "application/json";
            opts.headers["Content-Length"] = Buffer.byteLength(req_body);
            if (payload._user) opts.headers["User"] = payload._user;
            if (payload._token) opts.headers["AccessToken"] = payload._token;
        }

        console.log(opts);


        const ans_raw = await new Promise((resolve, reject) => {
            const req = cfg.adapter
                .request(opts, (response) => {
                    let body = '';
                    response.on("data", (chunk) => body += chunk);
                    response.on("end", () => resolve(body));
                })
                .on("error", (err) => reject(err))
                //.write(req_body)
                .end(req_body)
            ;
        });

        // json syntax errors and invalid payload struct will throw
        //console.log(ans_raw);
        const ans = JSON.parse(ans_raw);
        switch (ans?.error) {
            case false:
                const { error: res_error, body, ...res_rest } = ans;
                if (undefined === body) throw new PPClientApi.PayloadError("missing valid .body; $: " + ans_raw);
                if (Object.keys(res_rest).length) throw new PPClientApi.PayloadError("unknown fields for result (" + Object.keys(res_rest).join(", ") + "); $: " + ans_raw);
                return body;
            case true:
                const { error: err_error, errorDisplay, errorCode, message, ...err_rest } = ans;
                if (undefined === errorCode) throw new PPClientApi.PayloadError("missing valid .errorCode; $: " + ans_raw);
                if (undefined === message) throw new PPClientApi.PayloadError("missing valid .message; $: " + ans_raw);
                if (Object.keys(err_rest).length) throw new PPClientApi.PayloadError("unknown fields for error (" + Object.keys(err_rest).join(", ") + "); $: " + ans_raw);
                throw new PPClientApi.Error({ errorDisplay, errorCode, message });
        }
        throw new PPClientApi.PayloadError("malformed answer; $: " + ans_raw);
    };


/**************************************************************************************************/
// User sign up flow
/**************************************************************************************************/

    /**
    * post /register
    * request an SMS and session token for login/signup (PPApi+Register.swift)
    * accepts: { phone: String }
    * returns: { session: String }
    */
    async register(data) {
        let payload = {
            user: data.phone,
        };
        return this._call("POST", "/register", payload);
    };

    /**
    * post /resendconfirmation
    * resend SMS with code (PPApi+ResendConfirmation.swift)
    * accepts: //TODO
    * returns: //TODO
    */
    async resendconfirmation(data) {
        //return this._call("POST", "/resendconfirmation");
    };

    /**
    * post /verify
    * validate SMS code and get accessToken (PPApi+Verify.swift)
    * accepts: { phone: String, code: String, session: String }
    * returns: { newUserFlow: Boolean, activeCard: Boolean, refreshToken: String, accessToken: String }
    */
    async verify(data) {
        let payload = {
            user: data.phone,
            code: data.code,
            session: data.session,
        };
        return this._call("POST", "/verify", payload);
    };

    /**
    * post /checkemail
    * checks if email already registered (PPApi+CheckEmail.swift)
    * accepts: //TODO
    * returns: //TODO
    */
    async checkemail(data) {
        //return this._call("POST", "/checkemail");
    };

    /**
    * post /refreshtoken
    * refreshes the access token (PPApi+RefreshToken.swift)
    * accepts: //TODO
    * returns: //TODO
    */
    async refreshtoken(data) {
        //return this._call("POST", "/refreshtoken");
    };


/**************************************************************************************************/
// Document upload
/**************************************************************************************************/
    async getuser(data) {
        let payload = {
            _user: data._user,
            _token: data._token,
        };
        return this._call("POST", "/getuser", payload);
    };


/**************************************************************************************************/
// Payments method management
/**************************************************************************************************/


/**************************************************************************************************/
// User settings update
/**************************************************************************************************/


/**************************************************************************************************/
// Recovery
/**************************************************************************************************/


/**************************************************************************************************/
// Merchants
/**************************************************************************************************/

    /**
    * get /getmerchants
    * legacy method that returns a full list of merchants grouped by categories (PPApi+GetMerchants.swift)
    */
    async getmerchants() {
        return this._call("GET", "/getmerchants");
    };

    /**
    * get /merchants
    * returns all merchants (for the web app)
    */
    async merchants() {
        return this._call("GET", "/merchants");
    };

    /**
    * get /categories
    * returns merchants by category (for the web app)
    * get /categories/{category}
    * returns a list of merchants by category with locations (for the web app)
    */
    async categories(data) {
        const { category } = data;
        const path = (null == category)
            ? "/categories"
            : "/categories/" + (category)
        return this._call("GET", path);
    };

    /**
    * get /listcategories
    * returns list of categories (for the web app)
    */
    async listcategories() {
        return this._call("GET", "/listcategories");
    };


/**************************************************************************************************/
// New loan flow
/**************************************************************************************************/


/**************************************************************************************************/
// Purchase management
/**************************************************************************************************/


/**************************************************************************************************/
// Wallet (Virtual cards)
/**************************************************************************************************/


/**************************************************************************************************/
// Apple Push
/**************************************************************************************************/

};

PPClientApi.TransportError = class PPClientApiTransportError extends Error {
    // invalid replies
    //constructor(message, options) {
    //    super(message, options);
    //}
};
PPClientApi.PayloadError = class PPClientApiPayloadError extends Error {
    // incorrect reply structure
    //constructor(message, options) {
    //    super(message, options);
    //}
};
PPClientApi.Error = class PPClientApiError extends Error {
    // things with error = true
    constructor(ans, options) {
        const { errorCode, message } = ans;
        super(`API error [${errorCode}]: ${message}`, options);
        this.ans = ans;
    }
};


module.exports.PPClientApi = PPClientApi;



})();
