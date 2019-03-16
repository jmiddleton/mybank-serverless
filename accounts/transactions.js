'use strict';

const AWS = require('aws-sdk');

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = (event, context, callback) => {
  const pagesize = event.queryStringParameters['page-size'];

  //console.log(JSON.stringify(event));

  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    KeyConditionExpression: 'customerId = :customerId and begins_with(accountId, :accountId)',
    //    FilterExpression: '',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId,
      ':accountId': event.pathParameters.accountId,
    }
  };
  params.Limit = pagesize ? pagesize : 50;

  if (event.queryStringParameters.nextkey) {
    params.ExclusiveStartKey = decodeAsJson(event.queryStringParameters.nextkey);
  }

  dynamoDb.query(params, (error, result) => {
    if (error) {
      console.log(error);
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t find accounts.',
      });
    }

    // create a response
    if (result && result.Items) {
      var body = {
        data: {
          transactions: result.Items
        }
      }
      addPaginationLinks(body, event.pathParameters, event.queryStringParameters, result);

      const response = {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true
        },
        body: JSON.stringify(body)
      };

      console.log(JSON.stringify(response));

      callback(null, response);
    } else {
      callback(null, {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Accounts not found'
      });
    }
  });
};

function addPaginationLinks(body, pathParameters, query, result) {
  var links = {
  };
  var meta = {
    totalRecords: result.Count,
    totalPages: 1
  }

  const basepath = "/accounts/" + pathParameters.accountId + "/transactions?";
  links.self = basepath + "text=" + query.text + "&nextkey=" + query.nextkey;
  links.first = basepath + "text=" + query.text;
  links.next = basepath + "text=" + query.text + "&nextkey=" + encodeJson(result.LastEvaluatedKey);

  //  prev: "",
  //  last: ""

  body.links = links;
  body.meta = meta;
}

function encodeJson(data) {
  if (data) {
    let buff = new Buffer(JSON.stringify(data));
    return buff.toString('base64');
  }
  return "";
}

function decodeAsJson(data) {
  if (data) {
    let buff = new Buffer(data, 'base64');
    return JSON.parse(buff.toString('ascii'));
  }
  return {};
}