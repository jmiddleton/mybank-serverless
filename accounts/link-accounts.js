'use strict';

const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");
const r2 = require("r2");

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

//este endpoint va ser invocado despues de recibir el access_token
//consultar las accounts y por cada una, send an sns con los datos de la misma
//multiple listener recibiran la account y haran algo como consultar balances, account details y transactions 
module.exports.handler = async (event) => {
    const data = JSON.parse(event.body);
    const principalId= event.requestContext.authorizer.principalId;

    try {
        let bank = await getBank(data.bank_code);
        if (bank) {
            let response = await r2(bank.cdr_url + "/accounts").json;

            if (response && response.data && response.data.accounts) {
                response.data.accounts.forEach(account => {
                    registerAccount(account, bank, principalId);
                    sendSNS(account, bank, principalId);
                });
            }
        }
        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};

async function sendSNS(account, bank, customerId) {
    let messageData = {
        Message: JSON.stringify({
            accountId: account.accountId,
            customerId: customerId,
            cdr_url: bank.cdr_url,
            bank_code: bank.code,
            token_id: ""
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

async function registerAccount(account, bank, customerId) {
    const timestamp = new Date().getTime();
    account.customerId = customerId;
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