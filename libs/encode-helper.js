
function encodeKeyAsJson(data) {
    if (data) {
        let buff = new Buffer(JSON.stringify(data));
        return buff.toString('base64');
    }
    return "";
}

function decodeKeyAsJson(data) {
    if (data) {
        let buff = new Buffer(data, 'base64');
        return JSON.parse(buff.toString('ascii'));
    }
    return {};
}

module.exports = {
    encodeKeyAsJson,
    decodeKeyAsJson
};