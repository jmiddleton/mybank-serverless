const axios = require("axios");
const uuid = require('uuid/v3');
const log4js = require('log4js');
const logger = log4js.getLogger('bank-client');
logger.level = 'debug';

module.exports.get = async (url, token, params) => {

    //TODO: get the version from bank info: const version = token.versions[url];

    const headers = {
        "Authorization": "Bearer " + token.access_token,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-v": "1",
        //x-fapi-auth-date
        //x-fapi-customer-ip-address
        //x-cds-User-Agent
        "x-fapi-interaction-id": uuid.URL
    };

    logger.debug("{'url': '" + url + "', 'headers': " + JSON.stringify(headers) + ", 'params': " + JSON.stringify(params) + "}");

    return await axios.get(url, { headers: headers, params: params });
}
