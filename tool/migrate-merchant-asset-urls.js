
const mysql_client = require('pp-mysql/client');
const {
    Q, q, qlike,
    $exe,
    $tbl,
    $col,
    $row,
    $one,
} = mysql_client.shorthands();

/**************************************************************************************************/

exports.main = async function main() {

    await mysql_client.$exe(`ALTER TABLE merchant ADD IF NOT EXISTS logo_fn VARCHAR(1024) DEFAULT NULL AFTER link, ADD IF NOT EXISTS image_fn VARCHAR(1024) DEFAULT NULL AFTER logo_fn`);

    await mysql_client.$trx({}, async (conn) => {

        let tbl = await conn.$tbl(`
            SELECT
                _rowid,
                merchantName,
                logo_fn,
                image_fn,
                logoURL,
                imageURL
            FROM
                merchant
            WHERE 1
                /* AND (logo_fn IS NULL OR image_fn IS NULL) */
            ORDER BY
                _rowid
            /* LIMIT 10 */
        `);
        console.table(tbl);
        for (let { _rowid, merchantName, logo_fn, image_fn, logoURL, imageURL } of tbl) {
            if (logoURL != null && logoURL) {
                let m = /^(https:\/\/client-assets-pp03uat\.s3\.eu-west-2\.amazonaws\.com\/)(.+)$/g.exec(logoURL);
                let fn = m && m[2];
                //console.log({ m, fn });
                if (fn) {
                    fn = decodeURIComponent(fn.replace(/\+/g, '%20'));
                    let sql = (`UPDATE merchant SET logo_fn = ${q(fn)}, logoURL = NULL WHERE _rowid = ${q(_rowid)} AND logoURL = ${q(logoURL)}`);
                    console.log(sql);
                    await conn.$exe(sql);
                }
            }
            if (imageURL != null && imageURL) {
                let m = /^(https:\/\/client-assets-pp03uat\.s3\.eu-west-2\.amazonaws\.com\/)(.+)$/g.exec(imageURL);
                let fn = m && m[2];
                //console.log({ m, fn });
                if (fn) {
                    fn = decodeURIComponent(fn.replace(/\+/g, '%20'));
                    let sql = (`UPDATE merchant SET image_fn = ${q(fn)}, imageURL = NULL WHERE _rowid = ${q(_rowid)} AND imageURL = ${q(imageURL)}`);
                    console.log(sql);
                    await conn.$exe(sql);
                }
            }
        }

    });


};


Promise.resolve(exports.main()).then((r) => void (undefined === r || console.log(r)), console.error);

