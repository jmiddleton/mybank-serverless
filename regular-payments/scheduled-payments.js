'use strict';

const jsonResponse = require("../libs/json-response");
const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;

const collectionHandlers = {
  "GET": getScheduledPayments,
}

const methodHandlers = {
  "GET": getScheduledPaymentsByAccount
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

async function getScheduledPayments(event) {
  const params = {
    TableName: process.env.SCHEDULED_PAYMENTS_TABLE,
    Limit: 500,
    ProjectionExpression: 'scheduledPaymentId, nickname, paymentSet, recurrence, payeeReference, payerReference',
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
          scheduledPayments: result.Items
        },
        links: {
          self: "/payments?page=0",
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
    return { error: "Scheduled Payments not found" };
  }
}

async function getScheduledPaymentsByAccount(event) {
  const params = {
    TableName: process.env.SCHEDULED_PAYMENTS_TABLE,
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
          scheduledPayments: result.Items
        },
        links: {
          self: "/accounts/" + event.pathParameters.accountId + "/payments?page=0",
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
    return { error: "Scheduled Payments not found" };
  }
}
