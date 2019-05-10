'use strict';

const moment = require('moment');
const jsonResponse = require("../libs/json-response");
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;
const _ = require('lodash');

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
    TableName: process.env.MERCHANT_TABLE,
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

  try {
    const result = await dynamoDb.query(params).promise();
    const merchants = _.chain(result.Items).sortBy('totalSpent').reverse().take(10);

    return jsonResponse.ok({
      data: {
        merchants: merchants
      }
    });
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "NotFound",
      message: "Merchant for the month not found"
    });
  }
};

function getMonth(month, add) {
  if (month) {
    return moment(month, "YYYY-MM").add(add, "months").format("YYYY-MM");
  }
  return "";
}