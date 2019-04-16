'use strict';

const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");
const axios = require("axios");
var qs = require('querystring');

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
        let bank = await getBank(data.bank_code);
        if (bank) {
            let token = await registerUserBankAuth(bank, data.auth_code, principalId);

            console.log(token);

            const headers = { Authorization: "Bearer " + token.access_token };
            let response = await axios.get(bank.cdr_url + "/accounts", { headers: headers });

            if (response && response.data && response.data.data && response.data.data.accounts) {
                response.data.data.accounts.forEach(account => {
                    registerAccount(account, bank, principalId);
                    sendSNS(account, bank, token, principalId);
                });
            }
        }
        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};

async function sendSNS(account, bank, token, principalId) {
    let messageData = {
        Message: JSON.stringify({
            accountId: account.accountId,
            customerId: principalId,
            cdr_url: bank.cdr_url,
            bank_code: bank.code,
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

async function registerAccount(account, bank, principalId) {
    const timestamp = new Date().getTime();
    account.customerId = principalId;
    account.created = timestamp;
    account.visible = true;
    account.institution = bank.code;

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

//TODO: exchange for an access token and ID token. 
//Your server makes this exchange by sending an HTTPS POST request. 
//The POST request is sent to the token endpoint, which you should retrieve 
//from the Discovery document using the key token_endpoint.
async function registerUserBankAuth(bank, auth_code, principalId) {
    const timestamp = new Date().getTime();

    const token_request = {
        code: auth_code,
        client_id: bank.oidc_config.client_id,
        client_secret: bank.oidc_config.client_secret,
        redirect_uri: bank.oidc_config.redirect_uri,
        grant_type: "authorization_code"
    };

    try {
        let token_response = await axios.post(bank.oidc_config.metadata.token_endpoint,
            qs.stringify(token_request),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

        token_response.customerId = principalId;
        token_response.created = timestamp;
        token_response.institution = bank.code;

        const params = {
            TableName: process.env.USER_BANK_AUTH_TABLE,
            Item: token_response
        };

        //await dynamoDb.put(params).promise();
        console.log("User authentication: " + principalId + " created successfully");
        return token_response;
    } catch (error) {
        console.error(error);
    }
}

async function getBank(code) {
    const params = {
        TableName: process.env.BANKS_TABLE,
        Key: {
            code: code
        }
    };

    try {
        let data = await dynamoDb.get(params).promise();
        return data.Item;
    } catch (error) {
        console.log(error);
        return undefined;
    }
};