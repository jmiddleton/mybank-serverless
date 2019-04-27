'use strict';

const AWS = require('aws-sdk');
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;

module.exports.handler = (event, context, callback) => {
  console.log("Processing transactions to aggregate spendings...");

  event.Records.forEach((record) => {
    let jsonRecord = undefined;
    let oldRecord = undefined;
    let amount = 0;

    if (record.eventName == 'INSERT') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      amount = new Number(jsonRecord.amount);
    } else if (record.eventName == 'MODIFY') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      oldRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
      amount = new Number(oldRecord.amount);
    } else if (record.eventName == 'REMOVE') {
      oldRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
      amount = new Number(oldRecord.amount);
    }

    if (amount < 0) {
      if (oldRecord !== undefined) {
        aggregateSpending(oldRecord, 1, -1);
      }
      if (jsonRecord !== undefined) {
        aggregateSpending(jsonRecord, -1, 1);
      }
    }
  });

  callback(null, `Successfully processed ${event.Records.length} records.`);
};

//sign: -1 reverse txn, 1 create new txn
function aggregateSpending(record, sign, sum) {
  const amount = new Number(record.amount);
  const monthCategory = record.valueDateTime.substring(0, 7) + '#' + record.category;

  //credit doesn't count as spending.
  if (amount >= 0) {
    return;
  }

  const params = {
    TableName: process.env.SPENDING_TABLE,
    Key: {
      customerId: record.customerId,
      month: monthCategory
    },
    UpdateExpression: 'SET #category = :category, #updated = :updated ADD #totalSpent :amount, #totalOfTrans :sumOfTrans',
    ExpressionAttributeNames: {
      '#category': 'category',
      '#totalSpent': 'totalSpent',
      '#updated': 'lastUpdated',
      '#totalOfTrans': 'totalOfTrans'
    },
    ExpressionAttributeValues: {
      ':category': record.category,
      ':amount': (sign * amount),
      ':updated': new Date().getTime(),
      ':sumOfTrans': sum
    },
    ReturnValues: 'UPDATED_NEW'
  };

  dynamoDb.update(params, function (err, data) {
    if (err) console.log(err);
  });
}