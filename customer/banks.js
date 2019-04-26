'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");

const collectionHandlers = {
  "GET": getBanks,
  "POST": createBanks
}
const methodHandlers = {
  "GET": getBank
}

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

async function handler(event) {
  let handlers = (event["pathParameters"] == null) ? collectionHandlers : methodHandlers;

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    return handlers[httpMethod](event);
  }

  return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function getBanks(event) {
  const params = {
    TableName: process.env.BANKS_TABLE
  };

  try {
    let data = await dynamoDb.scan(params).promise();
    return jsonResponse.ok(data.Items);
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Couldn\'t find banks",
      message: error.message
    });
  }
}

async function getBank(event) {
  try {
    const response = await getBankByCode(event.pathParameters.bankcode);
    return jsonResponse.ok(response);
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Couldn\'t find bank",
      message: error.message
    });
  }
}

async function createBanks(event) {
  const requestBody = JSON.parse(event.body);
  const putRequest = [];

  requestBody.forEach(bank => {
    putRequest.push({
      "PutRequest": {
        "Item": bank
      }
    })
  });

  const params = {
    RequestItems: {
      [process.env.BANKS_TABLE]: putRequest
    }
  }

  try {
    await dynamoDb.batchWrite(params).promise();
    return jsonResponse.ok();
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "SystemError",
      message: "Error creating banks"
    });
  }
};

async function getBankByCode(code) {
  const params = {
    TableName: process.env.BANKS_TABLE,
    Key: {
      code: code
    }
  };

  let data = await dynamoDb.get(params).promise();
  return data.Item;
}

module.exports = {
  handler,
  getBankByCode
};
