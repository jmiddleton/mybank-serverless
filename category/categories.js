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
    let putRequest = [];
    let dataImported = true;
    let chunkNumber = 1;

    try {
        while (requestBody.length > 0) {
            console.log('Processing chunk #' + chunkNumber + '...');

            const splitArrays = requestBody.splice(0, 25);
            splitArrays.forEach(cat => {
                putRequest.push({
                    "PutRequest": {
                        "Item": cat
                    }
                });
            });

            const params = {
                RequestItems: {
                    [process.env.CATEGORIES_TABLE]: putRequest
                }
            }

            try {
                await dynamoDb.batchWrite(params).promise();
                chunkNumber++;
                dataImported = true;
                console.log('Chunk #' + chunkNumber + ' processed successfully.');
            } catch (error) {
                dataImported = false;
                console.log(error);
                console.log('Fail chunk #' + chunkNumber);
            } finally {
                putRequest = [];
            }
        }
    } catch (error) {
        console.log(error);
    }

    if (dataImported) {
        return jsonResponse.ok();
    } else {
        return jsonResponse.notFound({
            error: "SystemError",
            message: "Error loading bulk categories, please check server logs"
        });
    }
};
