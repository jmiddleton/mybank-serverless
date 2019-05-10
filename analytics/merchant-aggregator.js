'use strict';

const AWS = require('aws-sdk');
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;

module.exports.handler = (event, context, callback) => {
  console.log("Processing transactions to aggregate merchants...");

  event.Records.forEach((record) => {
    let jsonRecord;

    if (record.eventName == 'INSERT') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      aggregate(jsonRecord, -1, 1);
    } else if (record.eventName == 'REMOVE') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
      aggregate(jsonRecord, 1, -1);
    }
  });

  callback(null, `Successfully processed merchants for ${event.Records.length} records.`);
};

//sign: -1 reverse txn, 1 create new txn
function aggregate(record, sign, sum) {
  const amount = new Number(record.amount);

  //credit doesn't count as spending.
  if (isNull(record.merchantName) || record.category === 'Income' || record.category === 'Transfers') {
    return;
  }

  const merchantMonth = getValidDate(record) + '#' + record.merchantName;
  const params = {
    TableName: process.env.MERCHANT_TABLE,
    Key: {
      customerId: record.customerId,
      month: merchantMonth
    },
    UpdateExpression: 'SET #merchantName = :merchantName, #updated = :updated ADD #totalSpent :amount, #totalOfTrans :sumOfTrans',
    ExpressionAttributeNames: {
      '#merchantName': 'merchantName',
      '#totalSpent': 'totalSpent',
      '#updated': 'lastUpdated',
      '#totalOfTrans': 'totalOfTrans'
    },
    ExpressionAttributeValues: {
      ':merchantName': record.merchantName,
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
function isNull(value) {
  return !value || value == null || value === "" || value === "null";
}