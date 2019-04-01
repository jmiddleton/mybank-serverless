'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

var dynamodbOfflineOptions = {
    region: "localhost",
    endpoint: "http://localhost:8000"
},
    isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
    ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
    : new AWS.DynamoDB.DocumentClient();

module.exports.getCategoryByCode = async (mcode, callback) => {
    const params = {
        TableName: process.env.CATEGORIES_TABLE,
        Key: {
            code: mcode
        }
    };

    try {
        const data = await dynamoDb.get(params).promise();
        return data.Item;
    } catch (error) {
        return { "code": "0000", "category": "Others" };
    }
};
