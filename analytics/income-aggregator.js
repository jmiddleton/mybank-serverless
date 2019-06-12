'use strict';

const AWS = require('aws-sdk');
const moment = require('moment');
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;

module.exports.handler = (event, context, callback) => {
  console.log("Processing transactions to aggregate incomes...");

  event.Records.forEach((record) => {
    if (record.eventName == 'INSERT') {
      aggregateData(record.dynamodb.NewImage, 1);
    } else if (record.eventName == 'MODIFY') {
      aggregateData(record.dynamodb.OldImage, -1);
      aggregateData(record.dynamodb.NewImage, 1);
    } else if (record.eventName == 'REMOVE') {
      aggregateData(record.dynamodb.OldImage, -1);
    }
  });

  callback(null, `Successfully processed incomes for ${event.Records.length} records.`);
};

function aggregateData(image, sign) {
  const record = AWS.DynamoDB.Converter.unmarshall(image);
  //only income or direct credit.
  if (record.category !== 'Income') {
    return;
  }

  const amount = new Number(record.amount);
  const aggregatedMonth = getValidDate(record);
  const params = {
    TableName: process.env.INCOME_TABLE,
    Key: {
      customerId: record.customerId,
      month: aggregatedMonth
    },
    UpdateExpression: 'SET #updated = :updated, #monthName = :monthName ADD #totalIncome :amount',
    ExpressionAttributeNames: {
      '#monthName': 'monthName',
      '#totalIncome': 'totalIncome',
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