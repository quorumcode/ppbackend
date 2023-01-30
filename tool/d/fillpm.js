(function() {

    const util = require('util');
    const exec = util.promisify(require('child_process').exec);

    /// Command line args
    const ARG = {
        TARGET: 'TARGET',///< Target database - mock, test, prod
    };

    const { Cmd } = require('./cmd.js');

    class FillPM {

        /// REQUIRED Options/args description
        static optsargs() {
            return [
                ARG.TARGET + ' /(mock|test|prod)/ =mock - Target database',
            ];
        }

        /// REQUIRED Target function
        static async run(opts) {
            const target = opts[ARG.TARGET];

        // Hardcode link to mysql socket for mock
            if ('mock' === target) {
                process.env.MYSQLCFG = 'mysql://root@mysql-local/v201-debug-mock?socketPath=tmp/mysql/mysql.sock';
            }
        // Extract MySQL link from YAML
            else await this.MYSQLCFG(target);

        // Extract Stripe Key from YAML
            await this.stripeKey(target);

            if ('prod' === target) throw new Error(`Denied prod update`);

            const { retrievePM } = require('stripe-layer')
            const { Paymeth } = require('pp-admin');

            const { body: paymeths } = await Paymeth.tbl([]);
            //console.log(JSON.stringify(paymeths, null, 2));

        // Apply search to all models in parallel
            const promises = paymeths.map(async (paymeth) => {
                const { id, sid } = paymeth;
                let pmdata;
                try {
                    pmdata = await retrievePM(sid);
                } catch (e) {
                    console.error(e.toString());
                    console.log(`Skip ${sid}`);
                    return;
                }
                //console.log(`${sid}\n${JSON.stringify(pmdata, null, 2)}`);
                const {
                    funding, expire_year, expire_month,
                    country_code, name, fingerprint, support3dsecure,
                } = pmdata;
                const update = {
                    funding, expire_year, expire_month,
                    country_code, name, fingerprint, support3dsecure,
                };
                Object.keys(update).forEach((field) => {
                    const value = update[field];
                    const tovalue = typeof value
                    if (["string", "number"].includes(tovalue)) {
                        if (String(paymeth[field]) === String(value)) delete update[field];
                    }
                    else if ("boolean" === tovalue) {
                        if ((!!paymeth[field]) === (!!value)) delete update[field];
                    }
                // unsupported type (or value not exists)
                    else delete update[field];
                });

                if (Object.keys(update).length > 0) {
                    console.log(`UPDATE ${id}\n${JSON.stringify(update, null, 2)}`);
                    Paymeth.upd(id, update, []);
                }
            });

        // Wait all and return
            await Promise.all(promises);
        }

        static async MYSQLCFG(target) {
            const { error, stdout, stderr } = await exec(`yq '.Mappings.InstanceMode2Env.MYSQLCFG.${target}' v2x.yaml`);
            if ((error) || (stderr)) {
                throw new Error(`Fail extract MYSQLCFG of ${target}`);
            }
            process.env.MYSQLCFG = this.extractYamlValue(stdout);
        }

        static async stripeKey(target) {
            const { error, stdout, stderr } = await exec(`yq '.Mappings.InstanceMode2Env.stripeKey.${target}' v2x.yaml`);
            if ((error) || (stderr)) {
                throw new Error(`Fail extract stripeKey of ${target}`);
            }
            process.env.stripeKey = this.extractYamlValue(stdout);
        }

        static extractYamlValue(stdout) {
            return stdout.replace(/^\s*"/, '').replace(/"\s*$/, '');
        }
    }

    Cmd.run(FillPM);
})();
