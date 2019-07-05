'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");

const handlers = {
    "GET": getMCCCodes,
    "POST": bulkLoadMCCCodes
}

var dynamodbOfflineOptions = {
    region: "localhost",
    endpoint: "http://localhost:8000"
},
    isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
    ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
    : new AWS.DynamoDB.DocumentClient();

//handle HTTP requests
async function handler(event) {
    let httpMethod = event["httpMethod"];

    if (httpMethod in handlers) {
        return handlers[httpMethod](event);
    }
    return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

//internal function
async function getMCCCodes(event) {
    const params = {
        TableName: process.env.MCC_CODES_TABLE
    };

    try {
        let data = await dynamoDb.scan(params).promise();
        return jsonResponse.ok(data.Items);
    } catch (error) {
        console.log(error);
        return jsonResponse.notFound({
            error: "NotFound",
            message: "MCC Codes not found"
        });
    }
}

async function bulkLoadMCCCodes(event) {
    const requestBody = JSON.parse(event.body);
    const putRequest = [];

    requestBody.forEach(mcc => {
        putRequest.push({
            "PutRequest": {
                "Item": mcc
            }
        })
    });

    const params = {
        RequestItems: {
            [process.env.MCC_CODES_TABLE]: putRequest
        }
    }

    try {
        await dynamoDb.batchWrite(params).promise();
        return jsonResponse.ok();
    } catch (error) {
        console.log(error);
        return jsonResponse.notFound({
            error: "SystemError",
            message: "Error loading MCC codes"
        });
    }
};

//function used by transactions-sync
async function getMCCCategoryByCode(mcode) {
    const params = {
        TableName: process.env.MCC_CODES_TABLE,
        Key: {
            code: mcode
        }
    };

    try {
        let data = await dynamoDb.get(params).promise();
        return data.Item;
    } catch (error) {
        return { "code": "0000", "category": "Uncategorized" };
    }
};

async function getCategoryByKey(keyword) {
    const params = {
        TableName: process.env.KEYWORD_CATEGORY_TABLE,
        Key: {
            keyword: keyword
        }
    };

    try {
        let data = await dynamoDb.get(params).promise();
        return data.Item;
    } catch (error) {
        throw error;
    }
};

async function addKeywordCategory(data) {
    data.last_updated = new Date().getTime();

    if (data.merchantName) {
        await dynamoDb.put({
            TableName: process.env.KEYWORD_CATEGORY_TABLE,
            Item: data
        }).promise();
    }
};

async function getCategoryByCode(code) {
    const params = {
        TableName: process.env.CATEGORIES_TABLE,
        Key: {
            code: code
        }
    };

    try {
        let data = await dynamoDb.get(params).promise();
        console.log(data);
        return data.Item;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    handler,
    getMCCCategoryByCode,
    getCategoryByKey,
    addKeywordCategory,
    getCategoryByCode
};