(function() {

    /// Command line options
    const OPT = {
        BASE_SH: 'b',///< Short option for base URL
        BASE_LN: 'base',///< Long option for base URL
        SESSION: 'session',///< Long option for session
        TOKEN: 'token',///< Long option for token
    };

    /// Command line args
    const ARG = {
        METHOD: 'method',///< Command line arg with method
        DATA: 'data',///< Command line arg with data in JSON format for call PPClientAPI
    };

    /// Internal methods of PPClient
    const METHOD = {
        SETMOCKCFG: 'setmockcfg',///< Fill config for mock entrypoint
        SETTESTCFG: 'settestcfg',///< Fill config for test entrypoint
        SETPRODCFG: 'setprodcfg',///< Fill config for prod entrypoint
    };

    /// Configs for mock/test/prod
    const CONFIG = {
        [METHOD.SETMOCKCFG]: {[OPT.BASE_LN]: 'http://127.0.0.1:3000'},
        [METHOD.SETTESTCFG]: {[OPT.BASE_LN]: 'https://q5ibv6w5cj.execute-api.eu-west-2.amazonaws.com/stage'},
        [METHOD.SETPRODCFG]: {[OPT.BASE_LN]: 'https://iuelkuude2.execute-api.eu-west-2.amazonaws.com/stage'},
    };

    /// Fields of method
    const FIELD = {
        DESC: 'desc',///< Text description
        API: 'api',///< API class
        METHOD: 'method',///< Method of API class
        MODEL: 'model',///< Model class for input for method
    };

    const http = require("http");
    const https = require("https");
    const path = require('path');
    const fs = require('fs');
    const { Cmd, strbody } = require('./cmd.js');

    const PollenPay = require('pollen_pay');

    const shift = '\n        ';

    // PollenPay command line client
    class PPClient {

        /// Methods fields
        static method2fields = {
            [METHOD.SETMOCKCFG]: {[FIELD.DESC]: 'Set config for mock entrypoint'},
            [METHOD.SETTESTCFG]: {[FIELD.DESC]: 'Set config for test entrypoint'},
            [METHOD.SETPRODCFG]: {[FIELD.DESC]: 'Set config for prod entrypoint'},
        }
        static methodsFilled = false;

        /// REQUIRED Options/args description
        static optsargs() {
            PPClient.fillMethods();
            let smethods = '';
            Object.keys(PPClient.method2fields).forEach((method) => {
                smethods += '    ' + method + shift + PPClient.method2fields[method][FIELD.DESC] + '\n';
            });
            smethods = ' /(' + Object.keys(PPClient.method2fields).join('|') + ')/' + ' - Method, one of:\n' + smethods;
            return [
                OPT.BASE_SH + ',' + OPT.BASE_LN + ' ' + /^https?:\/\/.+/.toString() + ' =http://127.0.0.1:3000 - Base URL',
                ',' + OPT.SESSION + ' + - Session',
                ',' + OPT.TOKEN + ' + - Token',
                ARG.METHOD + smethods,
                ARG.DATA + ' + ={} - Payload for method as JSON, for example, "{ phone: 1234 }"',
            ];
        }

        /// Fill methods from PollenPay API classes
        static fillMethods() {
            if (PPClient.methodsFilled) return;
            Object.assign(require("util").inspect.defaultOptions, { showHidden: true });
            Object.keys(PollenPay).forEach((api) => {
                if (!/^.+Api$/.test(api)) return;
                const apitext = fs.readFileSync(path.join(__dirname, 'ppapi-client', 'dist', 'api', api + '.js'), { encoding: 'utf8' });
                Object.getOwnPropertyNames(PollenPay[api].prototype).forEach((method) => {
                    if (/(OPTIONS|constructor|WithHttpInfo)$/.test(method)) return;
                    const rkey = RegExp('key:\\s+"' + method + '"').exec(apitext);
                    if (!rkey) return;
                    const key = rkey[0];
                    if (!key) return;
                    const head = apitext.substr(0, apitext.indexOf(key));
                    const rcs = Array.from(head.matchAll(/\/\*(([^*]+|\*[^\/])+)\*\//g));
                    if (!rcs) return;
                    const rc = rcs[rcs.length - 1];
                    let desc = ''; let model = ''; let resp = '';
                    if (rc) {
                        desc = rc[1];
                        const rmodel = /@param\s+{module:model\/([_a-zA-Z0-9]+)}/.exec(desc);
                        if (rmodel) model = rmodel[1];
                        const rresp = /@return.*module:model\/([_a-zA-Z0-9]+)}/.exec(desc);
                        if (rresp) resp = rresp[1];
                        desc = desc.replace(/^[*\s]+/g, '').
                            replace(/\n[*\s]*/g, shift).
                            replace(/\s*@param[^\n]*/g, '').
                            replace(/\s*(data\sis\sof\stype|@return)[^\n]*/, '').
                            replace(/\n{2,}/g, '\n').
                            replace(/[\s\n]+$/, '');
                    }
                    PPClient.method2fields[method] = {
                        [FIELD.DESC]: `[${api}.${method}(` + (model ? model : '') + ')]' + (desc ? shift + desc : '') +
                            shift + '--> ' + (model ? model + ' { ' + Object.getOwnPropertyNames(PollenPay[model].prototype).join(', ').
                                replace('constructor, ', '') + ' }' : '{}') +
                            shift + '<-- ' + (resp ? resp + ' { ' + Object.getOwnPropertyNames(PollenPay[resp].prototype).join(', ').
                            replace('constructor, ', '') + ' }' : '{}'),
                        [FIELD.API]: api,
                        [FIELD.METHOD]: method,
                        [FIELD.MODEL]: model,
                    };
                });
            });
            PPClient.methodsFilled = true;
       }

        /// REQUIRED Target function
        static async run(opts) {
            console.log("run() with opts:");//DEBUG
            console.log(opts);//DEBUG

            let data = JSON.parse(opts[ARG.DATA]);
            if (!data) {
                console.error(`Invalid JON in "${ARG.DATA}" "${opts[ARG.DATA]}"`)
                return;
            }

            const method = opts[ARG.METHOD];

        // Internal methods for set config
            const setcfg = CONFIG[method];
            if (setcfg) {
                const fn = Cmd.fncfg(opts, PPClient);
                Cmd.savecfg(fn, setcfg);
                return;
            }

        // Else API method
            const fields = PPClient.method2fields[method];

        // Set base URL to APIClient
            const apiClient = new PollenPay.ApiClient(opts[OPT.BASE_SH] || opts[OPT.BASE_LN]);

        // Use created ApiClient for make API class
            const apiClassName = fields[FIELD.API];
            const modelClassName = fields[FIELD.MODEL];
            const api = new PollenPay[apiClassName](apiClient);

            try {
                if (modelClassName) {
                // Call method with model data
                    data = PollenPay[modelClassName].constructFromObject(data);
                }
                const r = await api[method](data);

                console.log(r);

            // Update session and token in config
                const body = r?.body;
                const session = body?.[OPT.SESSION];
                const token = body?.[OPT.TOKEN];
                if ((session) || (token)) {
                    const fn = Cmd.fncfg(opts, PPClient);
                    const cfg = Cmd.loadcfg(fn);
                    if (session) cfg[OPT.SESSION] = session;
                    if (token) cfg[OPT.TOKEN] = token;
                    Cmd.savecfg(fn, cfg);
                }
            }
            catch (e) {
                console.error(e);
            }
        }
    }

    Cmd.run(PPClient);
})();
