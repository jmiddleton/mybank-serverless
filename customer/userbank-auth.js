'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");
const userbankDao = require("./userbank-auth-dao.js");

const collectionHandlers = {
  "GET": getUserBankAuths
}
const methodHandlers = {
  "GET": getUserBankAuth,
  "DELETE": unlinkUserBankAuth,
  "POST": refreshUserBankAuth //TODO: IT SHOULD BE PUT?
}

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = async (event) => {
  let handlers = (event["pathParameters"] == null) ? collectionHandlers : methodHandlers;

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    return handlers[httpMethod](event);
  }

  return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function getUserBankAuths(event) {
  const params = {
    TableName: process.env.USER_BANK_AUTH_TABLE,
    //ProjectionExpression: 'bank, last_updated, expires_in',
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

async function getUserBankAuth(event) {
  try {
    const item = await userbankDao.getUserBankAuth(event.pathParameters.bankcode, event.requestContext.authorizer.principalId)

    if (item) {
      return jsonResponse.ok(item);
    } else {
      return jsonResponse.notFound({ error: "NotFound", message: "Could not find user bank authorization" });
    }
  } catch (error) {
    console.log(error);
    return jsonResponse.serverError({ error: "DBError", message: error.message });
  }
}

async function refreshUserBankAuth(event) {
  const data = JSON.parse(event.body);
  const principalId = event.requestContext.authorizer.principalId;

  try {
    userbankDao.registerUserBankAuth(data, principalId);
  } catch (error) {
    console.error(error);
    return jsonResponse.serverError({ error: "DBError", message: error.message });
  }
  return jsonResponse.ok({ message: "Bank authorization successfully refreshed" });
}

async function unlinkUserBankAuth(event) {
  const params = {
    TableName: process.env.USER_BANK_AUTH_TABLE,
    Key: {
      customerId: event.requestContext.authorizer.principalId,
      bank: event.pathParameters.bankcode
    }
  };

  try {
    dynamoDb.delete(params).promise();
    console.log("Bank authorization successfully deleted");
  } catch (error) {
    console.error(error);
  }
  return jsonResponse.ok({ message: "Bank authorization successfully deleted" });
}
