'use strict';

const jsonResponse = require("../libs/json-response");
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;

module.exports.handler = async (event) => {
  const params = {
    TableName: process.env.SAVINGS_TABLE,
    Limit: 5,
    KeyConditionExpression: 'customerId = :customerId AND #month >= :month',
    ExpressionAttributeNames: {
      '#month': 'month'
    },
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId,
      ':month': event.pathParameters.month
    }
  };

  if (event.queryStringParameters && event.queryStringParameters['page-size']) {
    params.Limit = event.queryStringParameters['page-size'];
  }

  try {
    let result = await dynamoDb.query(params).promise();
    return jsonResponse.ok({
      data: {
        savings: result.Items
      }
    });
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "NotFound",
      message: "Savings not found"
    });
  }
};