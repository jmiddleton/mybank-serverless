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

  const params = {
    TableName: process.env.PAYEES_TABLE,
    Key: {
      'payeeId': event.pathParameters.id,
      'customerId': event.requestContext.authorizer.principalId
    },
    ExpressionAttributeNames: {
      '#nn': 'name',
    },
    ExpressionAttributeValues: {
      ':name': data.name,
      ':description': data.description,
      ':BSB': data.BSB,
      ':accountNumber': data.accountNumber,
      ':payeeType': data.payeeType,
      ':updatedAt': timestamp
    },
    UpdateExpression: 'SET #nn = :name, description = :description, BSB = :BSB, accountNumber = :accountNumber, payeeType = :payeeType, updatedAt = :updatedAt',
    ReturnValues: 'UPDATED_NEW',
  };

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
