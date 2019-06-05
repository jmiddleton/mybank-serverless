'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");
const _ = require('lodash');

const handlers = {
    "GET": getCategories,
    "POST": bulkLoadCategories
}

var dynamodbOfflineOptions = {
    region: "localhost",
    endpoint: "http://localhost:8000"
},
    isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
    ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
    : new AWS.DynamoDB.DocumentClient();

module.exports.handler = async (event) => {
    let httpMethod = event["httpMethod"];

    if (httpMethod in handlers) {
        return handlers[httpMethod](event);
    }
    return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function getCategories() {
    const params = {
        TableName: process.env.CATEGORIES_TABLE
    };

    try {
        let data = await dynamoDb.scan(params).promise();
        if (data && data.Items) {
            const rootCategories = _.filter(data.Items, { parent: "null" });
            return jsonResponse.ok(rootCategories);
        }
    } catch (error) {
        console.log(error);
        return jsonResponse.notFound({
            error: "NotFound",
            message: "Categories not found"
        });
    }
};

async function bulkLoadCategories(event) {
    const requestBody = JSON.parse(event.body);
    const putRequest = [];

    requestBody.forEach(cat => {
        putRequest.push({
            "PutRequest": {
                "Item": cat
            }
        })
    });

    const params = {
        RequestItems: {
            [process.env.CATEGORIES_TABLE]: putRequest
        }
    }

    try {
        await dynamoDb.batchWrite(params).promise();
        return jsonResponse.ok();
    } catch (error) {
        console.log(error);
        return jsonResponse.notFound({
            error: "SystemError",
            message: "Error loading bulk categories"
        });
    }
};
