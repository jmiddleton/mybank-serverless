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

module.exports.handler = async (event, context) => {

  event.Records.forEach((record) => {
    const jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

    if (record.eventName == 'INSERT') {
      aggregateSpending(jsonRecord);
      aggregateSavings(jsonRecord);
    } else if (record.eventName == 'MODIFY') {
      //IF category is different, recalculate stats
      const oldRecord= AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
      
      reverseSpending(oldRecord);
      aggregateSpending(jsonRecord);
    }
  });

  return `Successfully processed ${event.Records.length} records.`;
};

async function aggregateSpending(record) {
  const amount = new Number(record.amount);

  //credit doesn't count as spending.
  if (amount >= 0) {
    return;
  }

  const monthCategory = record.valueDateTime.substring(0, 7) + '#' + record.category;

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
      ':amount': amount,
      ':updated': new Date().getTime(),
      ':sumOfTrans': 1
    },
    ReturnValues: 'ALL_NEW'
  };

  //Write updates to daily rollup table
  dynamoDb.update(params, (error, result) => {
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

async function reverseSpending(record) {
  const amount = new Number(record.amount);
  const monthCategory = record.valueDateTime.substring(0, 7) + '#' + record.category;

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
      ':amount': -1 * amount,
      ':updated': new Date().getTime(),
      ':sumOfTrans': -1
    },
    ReturnValues: 'ALL_NEW'
  };

  //Write updates to daily rollup table
  dynamoDb.update(params, (error, result) => {
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

function aggregateSavings(record) {
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
      ':amount': new Number(record.amount),
      ':updated': new Date().getTime(),
      ':monthName': getMonthName(aggregatedMonth)
    },
    ReturnValues: 'ALL_NEW'
  };

  //Write updates to daily rollup table
  dynamoDb.update(params, (error, result) => {
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