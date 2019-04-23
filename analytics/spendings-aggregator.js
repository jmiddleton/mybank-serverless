'use strict';

const AWS = require('aws-sdk');
const moment = require('moment');

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = async (event) => {

  event.Records.forEach((record) => {
    let jsonRecord = undefined;
    let oldRecord = undefined;
    let amount = 0;

    if (record.eventName === 'INSERT') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      amount = new Number(jsonRecord.amount);
    } else if (record.eventName === 'MODIFY') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      oldRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
      amount = new Number(oldRecord.amount);
    } else if (record.eventName === 'REMOVE') {
      oldRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
      amount = new Number(oldRecord.amount);
    }

    if (amount < 0) {
      if (oldRecord) {
        aggregateSpending(oldRecord, 1, -1);
      }
      if (jsonRecord) {
        aggregateSpending(jsonRecord, -1, 1);
      }
    }
  });

  return `Successfully processed ${event.Records.length} records.`;
};

//sign: -1 reverse txn, 1 create new txn
async function aggregateSpending(record, sign, sum) {
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
    }
  };

  dynamoDb.update(params, (error) => {
    if (error) {
      console.error(
        `Internal Error: Error updating spendings record with keys [${JSON.stringify(
          params.Key
        )}] and Attributes [${JSON.stringify(params.ExpressionAttributeValues)}]`
      );
      return;
    };
  });
}