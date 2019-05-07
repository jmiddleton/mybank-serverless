'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");

const handlers = {
  "GET": getTransactions,
  "POST": createTransaction,
  "PUT": updateTransaction
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

  callback(null, jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` }));
};

function getTransactions(event, context, callback) {
  const pagesize = getQueryParam(event, 'page-size', 50);
  const category = getQueryParam(event, 'category', undefined);
  const month = getQueryParam(event, 'month', undefined);
  const nextkey = getQueryParam(event, 'nextkey', '');
  const accountId = event.pathParameters.accountId;

  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    Limit: pagesize
  };

  let filter = getFilter(category, month);

  if (!category) {
    params.KeyConditionExpression = 'customerId = :customerId and begins_with(accountId, :accountId)';
    params.ExpressionAttributeValues = {
      ':customerId': event.requestContext.authorizer.principalId,
      ':accountId': accountId + "#" + filter
    }
  } else {
    params.IndexName = 'accountIndex';
    params.KeyConditionExpression = 'customerId = :customerId and begins_with(accountFilter, :accountFilter)';
    params.ExpressionAttributeValues = {
      ':customerId': event.requestContext.authorizer.principalId,
      ':accountFilter': accountId + "#" + filter
    }
  }

  if (nextkey && nextkey.length > 0) {
    params.ExclusiveStartKey = decodeAsJson(nextkey);
  }

  console.log(JSON.stringify(params));

  dynamoDb.query(params, (error, result) => {
    if (error) {
      console.log(error);
      callback(null, jsonResponse.notFound({ error: "Couldn\'t find transactions" }));
      return;
    }

    // create a response - "2019-03-19T08:19:31.432Z",
    if (result && result.Items) {
      var body = {
        data: { transactions: result.Items }
      }
      addPaginationLinks(body, event.pathParameters, event.queryStringParameters, result);

      callback(null, jsonResponse.ok(body));
    } else {
      callback(null, jsonResponse.notFound({ error: "Transactions not found" }));
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
      callback(null, jsonResponse.error({ error: "Couldn\'t create a transaction" }));
      return;
    }
    callback(null, jsonResponse.ok(params.Item));
  });
}

function updateTransaction(event, context, callback) {
  const data = JSON.parse(event.body);

  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    Item: data
  };

  dynamoDb.put(params, (error) => {
    if (error) {
      callback(null, jsonResponse.error({ error: "Couldn\'t update a transaction" }));
      return;
    }
    callback(null, jsonResponse.ok(params.Item));
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

function getQueryParam(event, key, defaultValue) {
  if (event.queryStringParameters && event.queryStringParameters[key]) {
    return event.queryStringParameters[key];
  }
  return defaultValue;
}

function getFilter(category, month) {
  let filter = '';
  if (category) {
    filter = category + "#"
  }
  if (month) {
    filter = filter + month
  }
  return filter;
}