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

module.exports.update = (event, context, callback) => {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);

  console.log(data);
  console.log('----------');
  // validation
  // if (typeof data.idPayee !== 'string') {
  //   console.error('Validation Failed');
  //   callback(null, {
  //     statusCode: 400,
  //     headers: { 'Content-Type': 'text/plain' },
  //     body: 'Couldn\'t update payee.',
  //   });
  //   return;
  // }

  var params = {
    TableName: process.env.PAYEES_TABLE,
    Key: {
      'payeeId': event.pathParameters.id,
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

  // update the todo in the database
  dynamoDb.update(params, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t fetch the payee.',
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
      body: JSON.stringify(result.Attributes),
    };
    callback(null, response);
  });
};
