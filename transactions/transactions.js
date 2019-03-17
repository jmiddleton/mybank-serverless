'use strict';

const AWS = require('aws-sdk');

const handlers = {
  "GET": getTransactions,
  "POST": createTransaction
}

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = (event, context, callback) => {

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    return handlers[httpMethod](event, context, callback);
  }

  const response = {
    statusCode: 405,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      message: `Invalid HTTP Method: ${httpMethod}`
    }),
  };

  callback(null, response);
};

function getTransactions(event, context, callback) {

  const pagesize = event.queryStringParameters ? event.queryStringParameters['page-size'] : 50;
  const nextkey = event.queryStringParameters ? event.queryStringParameters.nextkey : "";

  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    KeyConditionExpression: 'customerId = :customerId and begins_with(accountId, :accountId)',
    //    FilterExpression: '',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId,
      ':accountId': event.pathParameters.accountId,
    }
  };
  params.Limit = pagesize;

  if (nextkey !== "") {
    params.ExclusiveStartKey = decodeAsJson(nextkey);
  }

  dynamoDb.query(params, (error, result) => {
    if (error) {
      console.log(error);
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t find accounts.',
      });
      return;
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

function createTransaction(event, context, callback) {
  const data = JSON.parse(event.body);

  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    Item: data
  };

  dynamoDb.put(params, (error) => {
    if (error) {
      console.error(error);
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t create the payee.',
      });
      return;
    }

    // create a response
    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(params.Item),
    };
    callback(null, response);
  });
}

function addPaginationLinks(body, pathParameters, query, result) {
  var links = {
  };
  var meta = {
    totalRecords: result.Count,
    totalPages: 1
  }

  const text = query ? query.text : "";
  const nextkey = query ? query.nextkey : "";

  const basepath = "/accounts/" + pathParameters.accountId + "/transactions?";
  links.self = basepath + "text=" + text + "&nextkey=" + nextkey;
  links.first = basepath + "text=" + text;
  links.next = basepath + "text=" + text + "&nextkey=" + encodeJson(result.LastEvaluatedKey);

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