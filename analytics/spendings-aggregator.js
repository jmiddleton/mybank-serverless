'use strict';

const AWS = require('aws-sdk');
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;

module.exports.handler = (event, context, callback) => {
  console.log("Processing transactions to aggregate spendings...");

  event.Records.forEach((record) => {
    let jsonRecord;
    let oldRecord;

    if (record.eventName == 'INSERT') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
    } else if (record.eventName == 'MODIFY') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      oldRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
    } else if (record.eventName == 'REMOVE') {
      oldRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
    }

    reverseSpending(oldRecord);
    aggregateSpending(jsonRecord);
  });

  callback(null, `Successfully processed spendings for ${event.Records.length} records.`);
};

function reverseSpending(record) {
  aggregateData(record, 1, -1);
}

function aggregateSpending(record) {
  aggregateData(record, -1, 1);
}

//sign: -1 reverse txn, 1 create new txn
function aggregateData(record, sign, sum) {
  if (!record) {
    return;
  }

  //credit doesn't count as spending.
  if (record.category === 'Income' || record.category === 'Transfers') {
    return;
  }

  const amount = new Number(record.amount);
  const monthCategory = getValidDate(record) + '#' + record.category;
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

function getValidDate(txn) {
  if (txn.postingDateTime && txn.postingDateTime != null && txn.postingDateTime != "null") {
    return txn.postingDateTime.substring(0, 7);
  }

  if (txn.valueDateTime) {
    return txn.valueDateTime.substring(0, 7);
  }
  return moment().format("YYYY-MM");
}