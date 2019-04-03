'use strict';

const AWS = require('aws-sdk');

var dynamodbOfflineOptions = {
    region: "localhost",
    endpoint: "http://localhost:8000"
},
    isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
    ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
    : new AWS.DynamoDB.DocumentClient();

module.exports.getMCCCategoryByCode = async (mcode) => {
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