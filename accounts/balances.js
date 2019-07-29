'use strict';

const jsonResponse = require("../libs/json-response");
const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;

const collectionHandlers = {
  "GET": getBalances,
}

module.exports.handler = async (event) => {
  let httpMethod = event["httpMethod"];
  
  if (httpMethod in collectionHandlers) {
    const response = await collectionHandlers[httpMethod](event);
    return jsonResponse.ok(response);
  }

  return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function getBalances(event) {
  const params = {
    TableName: process.env.BALANCES_TABLE,
    Limit: 500,
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();
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
      return body;
    }
  } catch (error) {
    console.log(error);
    return { error: "Balances not found" };
  }
}
