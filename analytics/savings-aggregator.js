'use strict';

const AWS = require('aws-sdk');
const moment = require('moment');
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;

module.exports.handler = (event, context, callback) => {
  console.log("Processing transactions to aggregate savings...");

  event.Records.forEach((record) => {
    if (record.eventName == 'INSERT') {
      aggregateSavings(record.dynamodb.NewImage, 1);
    } else if (record.eventName == 'REMOVE') {
      aggregateSavings(record.dynamodb.OldImage, -1);
    }
  });

  callback(null, `Successfully processed savings for ${event.Records.length} records.`);
};

function aggregateSavings(image, sign) {
  const record = AWS.DynamoDB.Converter.unmarshall(image);
  const amount = new Number(record.amount);
  const aggregatedMonth = getValidDate(record);

  const params = {
    TableName: process.env.SAVINGS_TABLE,
    Key: {
      customerId: record.customerId,
      month: aggregatedMonth
    },
    UpdateExpression: 'SET #updated = :updated, #monthName = :monthName ADD #totalSavings :amount',
    ExpressionAttributeNames: {
      '#monthName': 'monthName',
      '#totalSavings': 'totalSavings',
      '#updated': 'lastUpdated'
    },
    ExpressionAttributeValues: {
      ':amount': sign * amount,
      ':updated': new Date().getTime(),
      ':monthName': getMonthName(aggregatedMonth)
    },
    ReturnValues: 'UPDATED_NEW'
  };

  dynamoDb.update(params, function (err, data) {
    if (err) console.log(err);
  });
}

function getMonthName(month) {
  if (month) {
    return moment(month, "YYYY-MM").format("MMMM");
  }
  return "";
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