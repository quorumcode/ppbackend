const path = require('path');
process.env.MYSQLCFG = 'mysql://root@mysql-local/v201-debug-mock?socketPath=' + path.resolve(__dirname + '../../../../tmp/mysql/mysql.sock');

require('mocha');
const chai = require('chai');
chai.config.truncateThreshold = 0; // disable truncating
const { expect } = chai;

// Hack for return null in fields
const { Model } = require('pp-admin');
delete Model.patchRow;
delete Model.patchRows;

module.exports = {
    LEN: 5,// Length for table requests
    expect,
};
