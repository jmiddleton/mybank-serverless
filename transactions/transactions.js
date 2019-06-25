'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");
const encodeHelper = require("../libs/encode-helper");
const mcccodes = require("../category/mcccodes.js");
const moment = require('moment');

const methodHandlers = {
  "GET": getTransactionsByAccount,
  "PUT": updateTransaction
}
const collectionHandlers = {
  "GET": getTransactions
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
    const response = await handlers[httpMethod](event);
    return jsonResponse.ok(response);
  }

  return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function getTransactions(event) {
  const latest = getQueryParam(event, 'q', undefined);

  if (latest !== "latest") {
    return { error: "Transaction criteria not supported" };
  }

  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    Limit: 10,
    IndexName: 'latestTxnIndex',
    ScanIndexForward: false,
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();

    if (result && result.Items) {
      var body = {
        data: { transactions: result.Items }
      }
      return body;
    }
    return { error: "Transactions not found" };
  } catch (error) {
    console.log(error);
    return { error: "Error retrieving transactions" };
  }
}
async function getTransactionsByAccount(event) {
  const pagesize = getQueryParam(event, 'page-size', 25);
  const category = getQueryParam(event, 'category', undefined);
  const month = getQueryParam(event, 'month', undefined);
  const nextkey = getQueryParam(event, 'nextkey', '');
  const accountId = event.pathParameters.accountId;

  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    Limit: pagesize,
    ScanIndexForward: false
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
    params.ExclusiveStartKey = encodeHelper.decodeKeyAsJson(nextkey);
  }

  try {
    let result = await dynamoDb.query(params).promise();

    // create a response - "2019-03-19T08:19:31.432Z",
    if (result && result.Items) {
      var body = {
        data: { transactions: result.Items }
      }
      addPaginationLinks(body, event.pathParameters, event.queryStringParameters, result);

      return body;
    }
    return { error: "Transactions not found" };
  } catch (error) {
    console.log(error);
    return { error: "Error retrieving transactions" };
  }
};

async function updateTransaction(event) {
  const data = JSON.parse(event.body);
  data.accountFilter = data.accountId + "#" + data.category + "#" + data.postingDateTime;
  data.updated = moment().format();

  //TODO: update also keyword-category table
  //TODO: if "Apply to All" then update the category of transactions with the same description.
  mcccodes.addKeywordCategory({
    keyword: data.merchantName,
    category: data.category
  });

  return saveTransaction(data);
}

async function saveTransaction(data) {
  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    Item: data
  };

  try {
    await dynamoDb.put(params).promise();
    return params.Item;
  } catch (error) {
    console.log(error);
    return { error: "Error creating a transaction" };
  }
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
  links.next = basepath + "text=" + text + "&nextkey=" + encodeHelper.encodeKeyAsJson(result.LastEvaluatedKey);

  //  prev: "",
  //  last: ""

  body.links = links;
  body.meta = meta;
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