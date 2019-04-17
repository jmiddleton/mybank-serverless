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
        const bank = await getBank(data.bank_code);
        if (bank) {
            const userBankAuth = await registerUserBankAuth(bank, data.auth_code, principalId);
            if (userBankAuth) {
                const accounts = await getAccounts(bank, userBankAuth);
                accounts.forEach(account => {
                    registerAccount(account, userBankAuth);
                    sendSNS(account, userBankAuth);
                });
            } else {
                return jsonResponse.error({ error: "Failure to retrieve user authorization" });
            }
        } else {
            return jsonResponse.error({ error: "Bank not found" });
        }
        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};

async function getAccounts(bank, token) {
    const headers = { Authorization: "Bearer " + token.access_token };
    const accounts = await axios.get(bank.cdr_url + "/accounts", { headers: headers });
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

        if (token_response && token_response.data) {
            console.log("Token successfully exchanged with bank " + bank.code);
            const userBankAuth = {
                customerId: principalId,
                created: timestamp,
                bank: bank.code,
                access_token: token_response.data.access_token,
                id_token: token_response.data.id_token,
                expires_in: token_response.data.expires_in,
                token_type: token_response.data.token_type,
                cdr_url: bank.cdr_url
            };

            await dynamoDb.put({
                TableName: process.env.USER_BANK_AUTH_TABLE,
                Item: userBankAuth
            }).promise();

            console.log("User authentication: " + principalId + " created successfully");
            return userBankAuth;
        }
    } catch (error) {
        //TODO: improve error handling
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