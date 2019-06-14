'use strict';

const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");
const userbankDao = require("../customer/userbank-auth-dao.js");

var snsOpts = {
    region: "ap-southeast-2"
};

let sns = new AWS.SNS(snsOpts);

module.exports.handler = async (event) => {
    const data = JSON.parse(event.body);
    const principalId = event.requestContext.authorizer.principalId;

    try {
        const userBankAuth = await userbankDao.registerUserBankAuth(data, principalId);
        if (userBankAuth) {
            publishCustomerToken(userBankAuth);
        } else {
            return jsonResponse.error({ error: "Failure to retrieve user authorization" });
        }

        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error(err);
    }
};

async function publishCustomerToken(token) {
    let messageData = {
        Message: JSON.stringify({
            customerId: token.customerId,
            cdr_url: token.cdr_url,
            bank_code: token.bank,
            access_token: token.access_token,
            consent_duration: token.consent_duration,
            consent_scopes: token.consent_scopes
        }),
        TopicArn: process.env.customerTopicArn,
    };

    console.log("PUBLISHING CUSTOMER MESSAGE TO SNS:", messageData);
    try {
        await sns.publish(messageData).promise();
    } catch (err) {
        console.log(err);
    }
}