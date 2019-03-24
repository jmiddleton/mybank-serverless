'use strict';

const AWS = require('aws-sdk');
const moment = require('moment');

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = (event, context, callback) => {

  if (!event.pathParameters.month || event.pathParameters.month.length != 7){
    callback(null, {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Couldn\'t find spendings for the month.',
    });
    return;
  }

  const params = {
    TableName: process.env.SPENDING_TABLE,
    Limit: 5,
    KeyConditionExpression: 'customerId = :customerId AND #month BETWEEN :startdate AND :enddate',
    ExpressionAttributeNames: {
      '#month': 'month'
    },
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId,
      ':startdate': getMonth(event.pathParameters.month, -2),
      ':enddate': getMonth(event.pathParameters.month, 1)
    }
  };

  if (event.queryStringParameters && event.queryStringParameters['page-size']) {
    params.Limit = parseInt(event.queryStringParameters['page-size']);
  }

  dynamoDb.query(params, (error, result) => {
    if (error) {
      console.log(error);

      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t find spendings for the month.',
      });
      return;
    }

    // create a response
    if (result && result.Items) {
      const body = {
        data: {
          spendings: result.Items
        }
      }

      const response = {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true
        },
        body: JSON.stringify(body)
      };

      callback(null, response);
    } else {
      callback(null, {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Spendings not found'
      });
    }
  });
};

function getMonth(month, add) {
  if (month) {
    return moment(month, "YYYY-MM").add(add, "months").format("YYYY-MM");
  }
  return "";
}