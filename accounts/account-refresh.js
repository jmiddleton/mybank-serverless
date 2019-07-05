const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");
const userbankDao = require("../customer/userbank-auth-dao.js");

var snsOpts = {
    region: "ap-southeast-2"
};

isOffline = () => process.env.IS_OFFLINE;

if (isOffline()) {
    snsOpts.endpoint = "http://127.0.0.1:4002";
}

let sns = new AWS.SNS(snsOpts);

//this endpoint refresh account's details
module.exports.handler = async (event) => {
    const accountId = event.pathParameters.accountId;
    const principalId = event.requestContext.authorizer.principalId;
    const data = JSON.parse(event.body);

    try {
        let userBankAuth;
        if (data.auth_code) {
            userBankAuth = await userbankDao.registerUserBankAuth(data, principalId);
        } else {
            userBankAuth = await userbankDao.getUserBankAuth(data.bank_code, principalId);
        }

        if (userBankAuth) {
            //TODO: retrieve the account details
            const account = { accountId: accountId, productCategory: "TRANS_AND_SAVINGS_ACCOUNTS" };
            sendSNS(account, userBankAuth);
        } else {
            return jsonResponse.forbidden({ error: "TokenNotFound", message: "Access token not found" });
        }

        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};

async function sendSNS(account, token) {
    let messageData = {
        Message: JSON.stringify({
            accountId: account.accountId,
            productCategory: account.productCategory,
            customerId: token.customerId,
            cdr_url: token.cdr_url,
            bank_code: token.bank,
            access_token: token.access_token,
            consent_duration: token.consent_duration,
            consent_scopes: token.consent_scopes
        }),
        TopicArn: process.env.accountsTopicArn,
    };

    console.log("PUBLISHING ACCOUNT MESSAGE TO SNS:", messageData);
    try {
        sns.publish(messageData).promise();
    } catch (err) {
        console.log(err);
    }
}