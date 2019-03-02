'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

const dynamoDb = new AWS.DynamoDB.DocumentClient();

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
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      'payeeId': event.pathParameters.id,
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
      ':customerId': data.customerId,
      ':updatedAt': timestamp
    },
    UpdateExpression: 'SET #nn = :name, description = :description, BSB = :BSB, accountNumber = :accountNumber, payeeType = :payeeType, customerId = :customerId, updatedAt = :updatedAt',
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
