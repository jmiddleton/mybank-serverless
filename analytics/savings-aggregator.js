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
    let jsonRecord;

    if (record.eventName === 'INSERT') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      aggregateSavings(jsonRecord, 1);
    } else if (record.eventName === 'REMOVE') {
      jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
      aggregateSavings(jsonRecord, -1);
    }
  });

  return `Successfully processed ${event.Records.length} records.`;
};

function aggregateSavings(record, sign) {
  const amount = new Number(record.amount);
  const aggregatedMonth = record.valueDateTime.substring(0, 7);

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
    }
  };

  dynamoDb.update(params, (error) => {
    if (error) {
      console.error(
        `Internal Error: Error updating savings record with keys [${JSON.stringify(
          params.Key
        )}] and Attributes [${JSON.stringify(params.ExpressionAttributeValues)}]`
      );
      return;
    };
  });
}

function getMonthName(month) {
  if (month) {
    return moment(month, "YYYY-MM").format("MMMM");
  }
  return "";
}