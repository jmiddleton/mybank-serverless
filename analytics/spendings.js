'use strict';

const moment = require('moment');
const jsonResponse = require("../libs/json-response");
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;

module.exports.handler = async (event) => {
  let prefetch = 0;

  if (event.queryStringParameters && event.queryStringParameters['monthsToPrefetch']) {
    prefetch = -1 * new Number(event.queryStringParameters['monthsToPrefetch']);
  }

  if (!event.pathParameters.month || event.pathParameters.month.length != 7) {
    return jsonResponse.notFound({
      error: "BadRequest",
      message: "Month is mandatory"
    });
  }

  const params = {
    TableName: process.env.SPENDING_TABLE,
    Limit: 15,
    KeyConditionExpression: 'customerId = :customerId AND #month BETWEEN :startdate AND :enddate',
    FilterExpression: '#totalOfTrans > :amount',
    ExpressionAttributeNames: {
      '#month': 'month',
      '#totalOfTrans': 'totalOfTrans'
    },
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId,
      ':startdate': getMonth(event.pathParameters.month, prefetch),
      ':enddate': getMonth(event.pathParameters.month, 1),
      ':amount': 0
    }
  };

  if (event.queryStringParameters && event.queryStringParameters['page-size']) {
    params.Limit = parseInt(event.queryStringParameters['page-size']);
  }

  try {
    let result = await dynamoDb.query(params).promise();
    return jsonResponse.ok({
      data: {
        spendings: result.Items
      }
    });
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "NotFound",
      message: "Spendings for the month not found"
    });
  }
};

function getMonth(month, add) {
  if (month) {
    return moment(month, "YYYY-MM").add(add, "months").format("YYYY-MM");
  }
  return "";
}