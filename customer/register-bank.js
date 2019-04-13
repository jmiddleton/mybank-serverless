'use strict';

const AWS = require("aws-sdk"); // must be npm installed to use
const jsonResponse = require("../libs/json-response");

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

    try {
        let bank = await getBank(data.bank_code);
        if (bank) {
            sendSNS(event, bank);
        }
        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};

async function sendSNS(event, bank) {
    let messageData = {
        Message: JSON.stringify({
            customerId: event.requestContext.authorizer.principalId,
            cdr_url: bank.cdr_url,
            bank_code: bank.code,
            token_id: ""
        }),
        TopicArn: process.env.banksTopicArn,
    };

    console.log("PUBLISHING MESSAGE TO SNS:", messageData);
    try {
        sns.publish(messageData).promise();
    } catch (err) {
        console.log(err);
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