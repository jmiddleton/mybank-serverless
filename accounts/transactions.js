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
    TableName: process.env.TRANSACTIONS_TABLE,
    Limit: 500,
    FilterExpression: 'customerId = :customerId and begins_with(accountId, :accountId)',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId,
      ':accountId': event.pathParameters.accountId,
    }
  };

  console.log(JSON.stringify(params));

  dynamoDb.scan(params, (error, result) => {
    if (error) {
      console.log(error);
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t find accounts.',
      });
    }

    // create a response
    if (result && result.Items) {
      const body = {
        data: {
          transactions: result.Items
        },
        links: {
          self: "/accounts/" + event.pathParameters.accountId + "/transactions?page=0",
          first: "",
          prev: "",
          next: "",
          last: ""
        },
        meta: {
          totalRecords: result.Items.length,
          totalPages: 1
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
        body: 'Accounts not found'
      });
    }
  });
};