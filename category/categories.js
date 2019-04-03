'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const jsonResponse = require("../libs/json-response");

var dynamodbOfflineOptions = {
    region: "localhost",
    endpoint: "http://localhost:8000"
},
    isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
    ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
    : new AWS.DynamoDB.DocumentClient();

module.exports.handler = async () => {
    const params = {
        TableName: process.env.CATEGORIES_TABLE
    };

    try {
        let data = await dynamoDb.scan(params).promise();
        return jsonResponse.ok(data.Items);
    } catch (error) {
        console.log(error);
        return jsonResponse.notFound({
            error: "Couldn\'t find categories",
            message: error.message
        });
    }
};
