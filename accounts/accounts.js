'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");

const collectionHandlers = {
  "GET": getAccounts
}
const methodHandlers = {
  "GET": getAccountById
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

function getAccounts(event, context, callback) {
  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
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
        body: 'Couldn\'t find accounts.',
      });
    }

    // create a response
    if (result && result.Items) {
      const body = {
        data: {
          accounts: result.Items
        },
        links: {
          self: "/accounts?page=0",
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

      callback(null, jsonResponse.ok(body));
    } else {
      callback(null, jsonResponse.notFound({
        error: "Accounts not found"
      }));
    }
  });
}

// Get account details endpoint
function getAccountById(event, context, callback) {

  const params = {
    TableName: process.env.ACCOUNTS_DETAILS_TABLE,
    Key: {
      customerId: event.requestContext.authorizer.principalId,
      accountId: event.pathParameters.accountId,
    }
  };

  dynamoDb.get(params, (error, result) => {
    if (error) {
      callback(null, jsonResponse.notFound({
        error: "Could not get accounts"
      }));
      return;
    }

    // create a response
    if (result && result.Item) {
      const data = {
        data: result.Item
      }

      callback(null, jsonResponse.ok(data));
    } else {
      callback(null, jsonResponse.notFound({
        error: "Accounts not found"
      }));
    }
  });
}
