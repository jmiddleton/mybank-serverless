'use strict';

const jsonResponse = require("../libs/json-response");
const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;

const collectionHandlers = {
  "GET": getDirectDebits,
}

const methodHandlers = {
  "GET": getDirectDebitsByAccount
}

module.exports.handler = async (event) => {
  let handlers = (event["pathParameters"] == null) ? collectionHandlers : methodHandlers;

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    const response = await handlers[httpMethod](event);
    return jsonResponse.ok(response);
  }

  return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function getDirectDebits(event) {
  const params = {
    TableName: process.env.DIRECT_DEBITS_TABLE,
    Limit: 500,
    ProjectionExpression: 'authorisedEntity, lastDebitDateTime, lastDebitAmount',
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();
    if (result && result.Items && result.Items.length > 0) {
      //TODO: ordenar de menor a mayor segun recurrence.nextPaymentDate
      const body = {
        data: {
          directDebits: result.Items
        },
        links: {
          self: "/direct-debits?page=0",
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
    return { error: "Direct Debits not found" };
  }
}

async function getDirectDebitsByAccount(event) {
  const params = {
    TableName: process.env.DIRECT_DEBITS_TABLE,
    Limit: 500,
    KeyConditionExpression: 'customerId = :customerId and accountId = :accountId',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId,
      ':accountId': event.pathParameters.accountId
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();
    if (result && result.Items && result.Items.length > 0) {
      const body = {
        data: {
          directDebits: result.Items
        },
        links: {
          self: "/accounts/" + event.pathParameters.accountId + "/direct-debits?page=0",
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
    return { error: "Direct Debits not found" };
  }
}
