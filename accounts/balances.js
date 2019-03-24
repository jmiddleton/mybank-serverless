'use strict';

const AWS = require('aws-sdk');

const collectionHandlers = {
  "GET": getBalances,
}

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = (event, context, callback) => {
  let handlers = (event["pathParameters"] == null) ? collectionHandlers : methodHandlers;

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    return handlers[httpMethod](event, context, callback);
  }

  const response = {
    statusCode: 405,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    body: JSON.stringify({
      message: `Invalid HTTP Method: ${httpMethod}`
    }),
  };

  callback(null, response);
};

function getBalances(event, context, callback) {
  const params = {
    TableName: process.env.BALANCES_TABLE,
    Limit: 500,
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId
    }
  };

  dynamoDb.query(params, (error, result) => {
    if (error) {
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t find balances.',
      });
    }

    // create a response
    if (result && result.Items) {
      const body = {
        data: {
          balances: result.Items
        },
        links: {
          self: "/accounts/balances?page=0",
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
        body: 'Balances not found'
      });
    }
  });
}
