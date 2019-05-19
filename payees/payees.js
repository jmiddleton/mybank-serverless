'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");
const dynamoDbHelper = require('../libs/dynamodb-helper');

const collectionHandlers = {
  "GET": getPayees,
  "POST": createPayee
}
const methodHandlers = {
  "GET": getPayee
}

const dynamoDb = dynamoDbHelper.dynamoDb;

module.exports.handler = async (event) => {
  let handlers = (event["pathParameters"] == null) ? collectionHandlers : methodHandlers;

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    return handlers[httpMethod](event);
  }

  return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function createPayee(event) {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);
  data.created = timestamp;
  data.customerId = event.requestContext.authorizer.principalId;

  const params = {
    TableName: process.env.PAYEES_TABLE,
    Item: data
  };

  try {
    await dynamoDb.put(params).promise();
    return params.Item;
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Error creating payee",
      message: error.message
    });
  }
};

async function getPayees(event) {
  const params = {
    TableName: process.env.PAYEES_TABLE,
    Limit: 500,
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
    return jsonResponse.notFound({
      error: "Error finding payees",
      message: error.message
    });
  }
}

async function getPayee(event) {
  const params = {
    TableName: process.env.PAYEES_TABLE,
    Key: {
      customerId: event.requestContext.authorizer.principalId,
      payeeId: event.pathParameters.id,
    }
  };

  try {
    let data = await dynamoDb.get(params).promise();
    return jsonResponse.ok(data.Item);
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Error retrieving payee",
      message: error.message
    });
  }
}

module.exports = {
  handler
};
