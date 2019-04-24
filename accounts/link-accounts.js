'use strict';

const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");
const userbankDao = require("../customer/userbank-auth-dao.js");
const axios = require("axios");

var dynamodbOfflineOptions = {
    region: "localhost",
    endpoint: "http://localhost:8000"
},
    isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
    ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
    : new AWS.DynamoDB.DocumentClient();

var snsOpts = {
    region: "ap-southeast-2"
};

if (isOffline()) {
    snsOpts.endpoint = "http://127.0.0.1:4002";
}

let sns = new AWS.SNS(snsOpts);

module.exports.handler = async (event) => {
    const data = JSON.parse(event.body);
    const principalId = event.requestContext.authorizer.principalId;

    try {
        const userBankAuth = await userbankDao.registerUserBankAuth(data.bank_code, data.auth_code, principalId);
        if (userBankAuth) {
            const accounts = await getAccounts(userBankAuth);
            accounts.forEach(account => {
                registerAccount(account, userBankAuth);
                sendSNS(account, userBankAuth);
            });
        } else {
            return jsonResponse.error({ error: "Failure to retrieve user authorization" });
        }

        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error(err);
    }
};

async function getAccounts(token) {
    const headers = { Authorization: "Bearer " + token.access_token };
    const accounts = await axios.get(token.cdr_url + "/accounts", { headers: headers });
    if (accounts && accounts.data && accounts.data.data && accounts.data.data.accounts) {
        return accounts.data.data.accounts;
    }
    return [];
}

async function sendSNS(account, token) {
    let messageData = {
        Message: JSON.stringify({
            accountId: account.accountId,
            customerId: token.customerId,
            cdr_url: token.cdr_url,
            bank_code: token.bank,
            access_token: token.access_token
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

async function registerAccount(account, token) {
    const timestamp = new Date().getTime();
    account.customerId = token.customerId;
    account.created = timestamp;
    account.visible = true;
    account.institution = token.bank;

    const params = {
        TableName: process.env.ACCOUNTS_TABLE,
        Item: account
    };

    try {
        await dynamoDb.put(params).promise();
        console.log("Account: " + account.accountId + " synched successfully");
    } catch (error) {
        console.error(error);
    }
}