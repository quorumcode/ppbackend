(function() {

    const path = require('path');
    const fs = require('fs');

    /// Cut first and last char of string
    function strbody(s) { return s.substr(1, s.length - 2); }

    /// Check empty object
    function isEmptyObject(obj) { return !Object.keys(obj).length; }

    const reOptName = /^([a-zA-Z0-9]|),([-a-zA-Z0-9]+)?/;///< RegExp for parse option name
    const reArgName = /^([-a-zA-Z0-9]+\*?)/;///< RegExp for arg name
    const reRe = /\s*(\/(?:[^\\\/]+|\\.)+\/|\*|\+)/;///< RegExp for parse regexp of option or arg
    const reDef = /\s*(?:=('[^']*'|"[^"]*"|\S+))?/;///< RegExp for parse default of option or arg
    const reInfo = /\s*-\s*([^]*)\s*$/;///< RegExp for parse info of option or arg
    const reOpt = RegExp(strbody(reOptName.toString()) + strbody(reRe.toString()) + '?' + strbody(reDef.toString()) + strbody(reInfo.toString()));///< RegExp for parse option
    const reArg = RegExp(strbody(reArgName.toString()) + strbody(reRe.toString()) + strbody(reDef.toString()) + strbody(reInfo.toString()));///< RegExp for parse arg

    const OPT = {
        HELP_SH: 'h',///< Short option for help
        HELP_LN: 'help',///< Long option for help
        UPDCFG: 'updcfg',///< Long option for update config
        CLRCFG: 'clrcfg',///< Long option for clear config
        SETCFG: 'setcfg',///< Long option for set config
        GETCFG: 'getcfg',///< Long option for print config
        CFG: 'cfg',///< Long option for set config filename from command line
    };

    class Cmd {

        /// Parse command line options and exec obj.run(options)
        static run(cls) {
            const utils = cls.utils ? cls.utils() : Cmd.utils();
            if (utils) Object.assign(require("util").inspect.defaultOptions, utils);
            const opts = Cmd.argvOptsArgs(cls);
            if ((false === opts) || (opts[OPT.HELP_SH]) || (opts[OPT.HELP_LN])) {
                Cmd.usage(opts, cls);
                return;
            }
            if (opts[OPT.SETCFG] || opts[OPT.UPDCFG] || opts[OPT.CLRCFG]) {
                Cmd.savecfg(Cmd.fncfg(opts, cls), opts[OPT.CLRCFG] ? {} : opts);
                if (!opts[OPT.GETCFG]) return;
            }
            if (opts[OPT.GETCFG]) {
                const fn = Cmd.fncfg(opts, cls);
                if (!fs.existsSync(fn)) console.log(`Absent config in "${fn}"`);
                else {
                    console.log(`Current config in "${fn}":`);
                    console.log(Cmd.loadcfg(fn));
                }
                return;
            }
            Promise.resolve(cls.run(opts)).then((r) => void (undefined === r || console.log(r)), console.error);
        }

        /// Parse options from command line and return {opt => value, ...}
        static argvOptsArgs(cls) {
            const [opt2re, arg2re, opt2def, opt2copy] = Cmd.parseOptsArgs(cls);
            if (false === opt2re) return false;

            const argv = process.argv.slice(2);

            /// First arg in args
            const firstKArg = (args) => {
                return Object.keys(args)[0];
            };

            /// Check * at the end of arg and cut it, else return false
            const isMultiKArg = (karg) => {
                if (/\*$/.test(karg)) return karg.substr(0, karg.length - 1);
                return false;
            }

            const longre = /^--([-a-zA-Z0-9]+)(=('[^']*'|"[^"]*"|.*))?/;///< long option with -- prefix
            const shortre = /^-([a-zA-Z0-9])(=('[^']*'|"[^"]*"|.*))?/;///< short option with - prefix

            let res = true; const opts = {};
            let opt = false; let re = false;
            argv.forEach((arg) => {
                if (false !== opt) {
                    if (/^['"]/.test(arg)) arg = strbody(arg);
                    if (!re.test(arg)) {
                        console.log(`Invalid value "${arg}" for option "${opt}"`);
                        res = false;
                    }
                    else opts[opt] = arg;
                    opt = false;
                    return;
                }

                let r = longre.exec(arg);
                if (!r) r = shortre.exec(arg);
                if (!r) {
                    if (!arg2re) {
                        console.log(`Unknown option format in "${arg}"`);
                        res = false;
                    }
                    else {
                        if ((/^'/.test(arg)) || (/^"/.test(arg))) arg = strbody(arg);
                        const karg = firstKArg(arg2re);
                        re = arg2re[karg];
                        re = RegExp(strbody(re));
                        if (!re.test(arg)) {
                            console.log(`Invalid value "${arg}" for arg "${karg}"`);
                            res = false;
                        }
                        else {
                            const mkarg = isMultiKArg(karg);
                            if (mkarg) {
                                if (!opts[mkarg]) opts[mkarg] = [arg];
                                else opts[mkarg].push(arg);
                            }
                            else {
                                opts[karg] = arg;
                                delete arg2re[karg];
                            }
                        }
                    }
                }
                else {
                    const o = r[1];
                    re = opt2re[o];
                    if (undefined === re) {
                        console.log(`Unknown option "${o}"`);
                        res = false;
                    }
                    else if (re !== '') {// option with value
                        re = RegExp(strbody(re));
                        if (!r[2]) opt = o;// wait value in next arg
                        else {
                            let v = r[3];
                            if (undefined === v) v = '';
                            if (/^['"]/.test(v)) v = strbody(v);
                            if (!re.test(v)) {
                                console.log(`Invalid value "${v}" for option "${o}"`);
                                res = false;
                            }
                            else opts[o] = v;
                        }
                    }
                    else opts[o] = true;
                }
            });
            if (false !== opt) {
                console.log(`No value for option "${opt}"`);
                res = false;
            }
            while (!isEmptyObject(arg2re)) {
                const karg = firstKArg(arg2re);
                const mkarg = isMultiKArg(karg);
                if ((!mkarg) || (!opts[mkarg])) {
                    const def = opt2def[karg];
                    if (def) {
                        if (mkarg) {
                            if (!opts[mkarg]) opts[mkarg] = [def];
                        }
                        else if (!opts[karg]) opts[karg] = def;
                    }
                    else {
                        if ((!opts[OPT.UPDCFG]) && (!opts[OPT.SETCFG]) && (!opts[OPT.GETCFG])) {
                            console.log(`Not found arg "${karg}"`);
                            res = false;
                            break;
                        }
                    }
                }
                delete arg2re[karg];
            }
        // If set config, use empty config, else load
            const cfg = opts[OPT.SETCFG] ? {} : Cmd.loadcfg(Cmd.fncfg(opts, cls));

        // Apply config as defaults
            Object.keys(cfg).forEach((opt) => {
                opt2def[opt] = cfg[opt];

            // Remove copy opt default
                if ((opt2copy[opt]) && (opt2def[opt2copy[opt]])) delete opt2def[opt2copy[opt]];
            });

        // Apply all defaults for absent options
            Object.keys(opt2def).forEach((opt) => {
                const def = opt2def[opt];
                const mkarg = isMultiKArg(opt);
                if (mkarg) {
                    if (!opts[mkarg]) opts[mkarg] = [def];
            // If no option and no copy option too
                }
                else if ((!opts[opt]) && ((!opt2copy[opt]) || (!opts[opt2copy[opt]]))) opts[opt] = def;
            });
            return res ? opts : false;
        }

        /// Prepare RegExp
        static getre(re) {
            if (!re) re = '';
            else if ('*' === re) re = '/.*/';
            else if ('+' === re) re = '/.+/';
            return re;
        }

        /// Prepare default
        static getdef(def) {
            if ((def) && (/^['"]/.test(def))) def = strbody(def);
            return def;
        }

        /// Parse options array and return [opts, args, defs],
        /// where opts is {opt => re, ...}, args is {opt => re}, defs is {opt => default}
        static parseOptsArgs(cls) {
            let res = true;
            const opt2re = {}; const arg2re = {}; const opt2def = {}; const opt2copy = {};
            Cmd.objOptsArgs(cls).forEach((s) => {
                const rk = reOpt.exec(s);
                if (!rk) {
                    const ra = reArg.exec(s);
                    if (!ra) {
                        console.log(`Invalid option/arg description: "${s}"`);
                        res = false;
                    }
                    else {
                        const arg = ra[1];
                        arg2re[arg] = Cmd.getre(ra[2]);
                        const def = Cmd.getdef(ra[3]);
                        if (def) opt2def[arg] = def;
                    }
                }
                else if ((!rk[1]) && (!rk[2])) {
                    console.log(`Invalid option description: "${s}"`);
                    res = false;
                }
                else {
                    const short = rk[1];
                    const long = rk[2];
                    const re = Cmd.getre(rk[3]);
                    const def = Cmd.getdef(rk[4]);
                    if (short) {
                        opt2re[short] = re;
                        if (def) opt2def[short] = def;
                        if (long) opt2copy[short] = long;
                    }
                    if (long) {
                        opt2re[long] = re;
                        if (def) opt2def[long] = def;
                        if (short) opt2copy[long] = short;
                    }
                }
            });
            return res ? [opt2re, arg2re, opt2def, opt2copy] : [false, false];
        }

        /// Print usage info
        static usage(opts, cls) {
            let sopts = '';
            let sargs = '';
            const cfg = Cmd.loadcfg(Cmd.fncfg(opts, cls));
            Cmd.objOptsArgs(cls).forEach((line) => {
                const rk = reOpt.exec(line);
                const ra = reArg.exec(line);
                if (rk) {
                    const short = rk[1];
                    const long = rk[2];
                    const re = Cmd.getre(rk[3]);
                    const def = Cmd.getdef(rk[4]);
                    const info = rk[5];
                    line = '';
                    if (short) line += '-' + short + ', ';
                    if (long) line += '--' + long;
                    if ((short) && (cfg[short])) line += ' (by config "' + cfg[short] + '")';
                    else if ((long) && (cfg[long])) line += ' (by config "' + cfg[long] + '")';
                    else if (def) line += ' (by default "' + def + '")';
                    if (re) line += ' RegExp ' + re;
                    line += '\n';
                    line += '    ' + info;
                    sopts += '\n  ' + line;
                }
                else if (ra) {
                    const arg = ra[1];
                    const re = Cmd.getre(ra[2]);
                    const def = Cmd.getdef(ra[3]);
                    const info = ra[4];
                    line = arg;
                    if (cfg[arg]) line += ' (by config "' + cfg[arg] + '")';
                    else if (def) line += ' (by default "' + def + '")';
                    if (re) line += ' RegExp ' + re;
                    line += '\n';
                    line += '    ' + info;
                    sargs += '\n  ' + line;
                }
            });
            if (sopts) sopts = '\nOptions:' + sopts;
            if (sargs) sargs = '\nArgs:' + sargs;
            console.log("Usage: " + path.basename(process.argv[0]) + ' ' + path.basename(process.argv[1]) + " [options][args]" + sopts + sargs);
        }

        /// Get object optsargs and attach Cmd options
        static objOptsArgs(cls) {
            const objopts = cls.optsargs();
            objopts.push(',' + OPT.CFG + ' + - Config filename, if absent used default path based on Class name');
            objopts.push(',' + OPT.UPDCFG + ' - Update config');
            objopts.push(',' + OPT.CLRCFG + ' - Clear config');
            objopts.push(',' + OPT.SETCFG + ' - Set config (clear then update)');
            objopts.push(',' + OPT.GETCFG + ' - Print config');
            objopts.push(OPT.HELP_SH + ',' + OPT.HELP_LN + ' - Help');
            return objopts;
        }

        /// Config file name
        static fncfg(opts, cls) {
            if ((opts) && (opts[OPT.CFG])) return opts[OPT.CFG];
            return path.join(__dirname, '..', '..', 'tmp', '.' + cls.name + '.cfg');
        }

        // Load config from file
        static loadcfg(fn) {
            if (!fs.existsSync(fn)) return {};
            return JSON.parse(fs.readFileSync(fn, { encoding: 'utf8' }));
        }

        /// Save config to file
        static savecfg(fn, opts) {
            for (const opt in [OPT.UPDCFG, OPT.CLRCFG, OPT.SETCFG, OPT.CFG]) {
                if (opts[opt]) delete opts[opt];
            }
            if (!isEmptyObject(opts)) {
                fs.writeFileSync(fn, JSON.stringify(opts), { encoding: 'utf8' });
                console.log(`Config saved to "${fn}":`)
                console.log(opts);
            }
            else if (fs.existsSync(fn)) {
                fs.unlinkSync(fn);
                console.log(`Config "${fn}" removed`)
            }
            else console.log(`Config "${fn}" already absent`)
        }

        static utils() {
            return {
                depth: 5,
                colors: true,
            };
        }
    }

    module.exports.Cmd = Cmd;
    module.exports.strbody = strbody;
})();

/*
Usage of Cmd example:

// Some class for call with Cmd
class Some {
    /// REQUIRED Options/args description
    static optsargs() {
        // Option define:
        //   [short],[long] [RegExp|*|+] [=default] - Description
        //   short option [a-zA-Z0-9], used with -, for example, -h
        //   long option [-a-zA-Z0-9]+, used with --, for example, --help
        //   if no Regexp - option without value
        // Arg define:
        //   arg[*] (RegExp|*|+) [=default] - Description
        //   arg [-a-zA-Z0-9]+\*?, name for position argument, * - endless repeating (return array)
        // + === /.+/
        // * === /.* /
        return [
            'i,ip-address ' + /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.toString() + ' = 127.0.0.1 - IP',// short and long option with regexp and default
            'p, ' + /\d{2,5}/.toString() + ' - Port',// only short option with regexp
            ',prefix * - Prefix',// only long option
            'database + =mock - Database',// arg with default
            'tables* + - Tables',// multiarg
        ];
    }

    /// REQUIRED Target function
    static async run(opts) {
        console.log("run() with opts:");
        console.log(opts);
    }

    /// Overwrite patch console
    static utils() {
        return {
            depth: 5,
            colors: true,
        };
    }
}

const { Cmd } = require('./cmd.js');
Cmd.run(Some);
*/
