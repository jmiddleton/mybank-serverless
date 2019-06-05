'use strict';

//This module will be used to configure user's profile: 
//categories, notifications and dashboard components

const jsonResponse = require("../libs/json-response");
const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;

const methodHandlers = {
    "GET": getProfile,
    "UPDATE": updateProfile
}

module.exports.handler = async (event) => {
    let httpMethod = event["httpMethod"];
    if (httpMethod in methodHandlers) {
        return methodHandlers[httpMethod](event);
    }

    return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function getProfile(event) {
    const params = {
        TableName: process.env.USER_PROFILE_TABLE,
        KeyConditionExpression: 'customerId = :customerId',
        ExpressionAttributeValues: {
            ':customerId': event.requestContext.authorizer.principalId
        }
    };

    try {
        let data = await dynamoDb.query(params).promise();
        return jsonResponse.ok(data.Items);
    } catch (error) {
        console.log(error);
    }
}

async function updateProfile(event) {
    //TODO: update categories or dashboard
}
