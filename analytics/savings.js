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

module.exports.handler = (event, context, callback) => {
  const params = {
    TableName: process.env.SAVINGS_TABLE,
    Limit: 5,
    KeyConditionExpression: 'customerId = :customerId and #month >= :month',
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

  dynamoDb.query(params, (error, result) => {
    if (error) {
      console.log(error);

      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t find savings for the month.',
      });
      return;
    }

    // create a response
    if (result && result.Items) {
      const body = {
        data: {
          savings: result.Items
        }
      }

      const response = {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true
        },
        body: JSON.stringify(body)
      };

      callback(null, response);
    } else {
      callback(null, {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Savings not found'
      });
    }
  });
};