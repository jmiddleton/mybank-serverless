'use strict';


const jsonResponse = require("../libs/json-response");
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;

module.exports.handler = async (event) => {
  const pagesize = getQueryParam(event, 'page-size', 50);
  const category = getQueryParam(event, 'category', undefined);
  const month = getQueryParam(event, 'month', undefined);
  const nextkey = getQueryParam(event, 'nextkey', '');

  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    Limit: pagesize
  };

  let filter = getFilter(category, month);

  params.IndexName = 'categoryIndex';
  params.KeyConditionExpression = 'customerId = :customerId and begins_with(categoryFilter, :categoryFilter)';
  params.ExpressionAttributeValues = {
    ':customerId': event.requestContext.authorizer.principalId,
    ':categoryFilter': filter
  }

  if (nextkey && nextkey.length > 0) {
    params.ExclusiveStartKey = decodeAsJson(nextkey);
  }

  try {
    let result = await dynamoDb.query(params).promise();
    if (result && result.Items) {
      var response = {
        data: { transactions: result.Items }
      }
      addPaginationLinks(response, event.pathParameters, event.queryStringParameters, result);

      return jsonResponse.ok(response);
    }
  } catch (error) {
    console.log(error);
  }
  return jsonResponse.notFound({
    error: "NotFound",
    message: "Transactions not found"
  });
};

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