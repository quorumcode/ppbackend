(function() {

    /// Command line args
    const ARG = {
        YAMLJSON: 'YamlJSON',///< Command line arg with file name of input JSON, extracted from YAML
        DEBJSON: 'DebJSON',///< Command line arg with file name for output JSON for debug.html
    };

    const path = require('path');
    const fs = require('fs');
    const { Cmd } = require('./cmd.js');

    class DebJSON {

        static src;

        /// REQUIRED Options/args description
        static optsargs() {
            return [
                ARG.YAMLJSON + ' + - File name of input JSON, extracted from YAML',
                ARG.DEBJSON + ' + - File name for output JSON for debug.html',
            ];
        }

        /// REQUIRED Target function
        static async run(opts) {
            const fnyaml = path.resolve(opts[ARG.YAMLJSON]);
            if (!fs.existsSync(fnyaml)) {
                console.error(`Not found '${fnyaml}'`)
                return;
            }
            const fndeb = path.resolve(opts[ARG.DEBJSON]);
            console.log(`--- Converting ${fnyaml} -> ${fndeb}`);
            this.src = this.loadJSON(fnyaml);
            const dst = this.extractMethods();
            this.saveJSON(fndeb, dst);
            console.log(`=== OK`)
        }

    // Extract all methods by paths
        static extractMethods() {
            const methods = [];
            Object.keys(this.src['paths']).forEach((path) => {
                const pmethods = this.extractMethod(path);
                pmethods.forEach((method) => methods.push(method));
            });
            return methods;
        }

    // Extract one method by path
        static extractMethod(path) {
            const r = [];
            ['get', 'post', 'put', 'patch', 'delete'].forEach((methType) => {
                const meth = this.src['paths'][path][methType];
                if (!meth) return;
                const { operationId: func, summary: title } = meth;
                const pr = { path, func, title, meth: methType.toUpperCase() };
                pr['api'] = `${meth['tags'][0]}Api`;
                const security = (meth['security'] || this.src['security']);
                if (security.length) {
                    const auths = Object.keys(security[0]);
                    if (auths.length) pr['auth'] = auths[0];
                }
                pr['request'] = this.extractSchema(meth['requestBody']?.['content']?.['application/json']?.['schema'] || {});
                pr['response'] = this.extractSchema(meth['responses']?.['200'] || {});
                r.push(pr);
            });
            if (!r.length) console.error(`Not found methods for ${path}`);
            return r;
        }

    // Extract one schema
        static extractSchema(schema) {
            if ("object" === typeof schema) {

            // Resolve reference, if need
                const ref = schema['$ref'];
                if (ref) {
                    schema = { ...schema};
                    delete schema['$ref'];
                    schema = { ...schema, ...this.getRef(ref)}
                }
            // Resolve all subreferences
                Object.keys(schema).forEach((k) => {
                    schema[k] = this.extractSchema(schema[k])
                });

            // If this is response, return schema only
                if (schema['content']?.['application/json']?.['schema']) {
                    schema = schema['content']['application/json']['schema'];
                }
            }
            return schema;
        }

    // Get object by reference
        static getRef(ref) {
            const parts = ref.split('/');
            let r = this.src;
            parts.forEach((part) => {
                if ('#' === part) return;
                r = r[part];
            });
            return r;
        }

    // Rean JSON to JS data
        static loadJSON(fn) {
            return JSON.parse(fs.readFileSync(fn, { encoding: 'utf8' }));
        }

    // Save JS data to JSON
        static saveJSON(fn, data) {
            return fs.writeFileSync(fn, JSON.stringify(data, null, 2), { encoding: 'utf8' });
        }
    }

    Cmd.run(DebJSON);
})();
