'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");

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

  callback(null, jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` }));
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
      callback(null, jsonResponse.notFound({ error: "Could not find balances" }));
      return;
    }

    // create a response
    if (result && result.Items && result.Items.length > 0) {
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

      callback(null, jsonResponse.ok(body));
    } else {
      callback(null, jsonResponse.notFound({ error: "Balances not found" }));
    }
  });
}
