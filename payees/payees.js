'use strict';

const jsonResponse = require("../libs/json-response");
const dynamoDbHelper = require('../libs/dynamodb-helper');

const collectionHandlers = {
  "GET": getPayees,
  "POST": createPayee
}
const methodHandlers = {
  "GET": getPayee,
  "PUT": updatePayee,
  "DELETE": deletePayee
}

const dynamoDb = dynamoDbHelper.dynamoDb;

module.exports.handler = async (event) => {
  let handlers = (event["pathParameters"] == null) ? collectionHandlers : methodHandlers;

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    return handlers[httpMethod](event);
  }

  return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function createPayee(event) {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);
  data.created = timestamp;
  data.customerId = event.requestContext.authorizer.principalId;

  const params = {
    TableName: process.env.PAYEES_TABLE,
    Item: data
  };

  try {
    await dynamoDb.put(params).promise();
    return jsonResponse.ok(params.Item);
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Error creating payee",
      message: error.message
    });
  }
};

async function updatePayee(event) {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);
  data.created = timestamp;
  data.customerId = event.requestContext.authorizer.principalId;

  var params = {
    TableName: process.env.PAYEES_TABLE,
    Key: {
      'payeeId': event.pathParameters.payeeId,
      'customerId': event.requestContext.authorizer.principalId
    },
    ExpressionAttributeNames: {
      '#nn': 'nickname',
      '#typp': 'type',
    },
    ExpressionAttributeValues: {
      ':nickname': data.nickname,
      ':description': data.description,
      ':typp': data.type,
      ':payeeUType': data.payeeUType,
      ':updatedAt': timestamp,
    },
    UpdateExpression: 'SET #nn = :nickname, description = :description, #typp = :typp, payeeUType = :payeeUType, updatedAt = :updatedAt',
    ReturnValues: 'UPDATED_NEW',
  };

  if (data.domestic) {
    params.ExpressionAttributeNames['#dom'] = 'domestic';
    params.ExpressionAttributeNames['#biller'] = 'biller';
    params.ExpressionAttributeNames['#int'] = 'international';
    params.UpdateExpression = params.UpdateExpression + ', #dom = :domestic REMOVE #biller, #int';
    params.ExpressionAttributeValues[':domestic'] = {
      'payeeAccountUType': 'account',
      'account': {
        'accountName': data.domestic.account.accountName,
        'bsb': data.domestic.account.accountNumber,
        'accountNumber': data.domestic.account.bsb
      }
    };

  } else if (data.biller) {
    params.ExpressionAttributeNames['#biller'] = 'biller';
    params.ExpressionAttributeNames['#dom'] = 'domestic';
    params.ExpressionAttributeNames['#int'] = 'international';
    params.UpdateExpression += ', #biller = :biller REMOVE #dom, #int';
    params.ExpressionAttributeValues[':biller'] = {
      'billerName': data.biller.billerName,
      'billerCode': data.biller.billerCode,
      'crn': data.biller.crn
    };
  }

  try {
    let data = await dynamoDb.update(params).promise();
    return jsonResponse.ok(data.Attributes);
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Error updating payee",
      message: error.message
    });
  }
};

async function deletePayee(event) {
  const params = {
    TableName: process.env.PAYEES_TABLE,
    Key: {
      customerId: event.requestContext.authorizer.principalId,
      payeeId: event.pathParameters.payeeId,
    },
  };

  try {
    await dynamoDb.delete(params).promise();
    return jsonResponse.ok();
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Error deleting payee",
      message: error.message
    });
  }
};

async function getPayees(event) {
  const params = {
    TableName: process.env.PAYEES_TABLE,
    Limit: 500,
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId
    }
  };

  try {
    let data = await dynamoDb.query(params).promise();
    return jsonResponse.ok(data.Items);
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Error finding payees",
      message: error.message
    });
  }
}

async function getPayee(event) {
  const params = {
    TableName: process.env.PAYEES_TABLE,
    Key: {
      customerId: event.requestContext.authorizer.principalId,
      payeeId: event.pathParameters.payeeId,
    }
  };

  try {
    let data = await dynamoDb.get(params).promise();
    return jsonResponse.ok(data.Item);
  } catch (error) {
    console.log(error);
    return jsonResponse.notFound({
      error: "Error retrieving payee",
      message: error.message
    });
  }
}