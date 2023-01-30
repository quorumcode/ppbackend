const { Auth } = require('pp-admin');

exports.lambda = async (request) => await Auth.exec(request);
