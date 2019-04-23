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
    const jsonRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
    const amount = new Number(jsonRecord.amount);

    if (record.eventName === 'INSERT') {
      if (amount > 0) {
        //aggregateIncome(jsonRecord, -1, 1);
      } else {
        aggregateSpending(jsonRecord, -1, 1);
      }
      aggregateSavings(jsonRecord, 1);
    } else if (record.eventName === 'MODIFY') {
      //if category is different then recalculate stats
      const oldRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);

      if (record.category !== oldRecord.category) {
        if (amount > 0) {
          //aggregateIncome(oldRecord, 1, -1);
          //aggregateIncome(jsonRecord, -1, 1);
        } else {
          aggregateSpending(oldRecord, 1, -1);
          aggregateSpending(jsonRecord, -1, 1);
        }
      }
    } else if (record.eventName === 'REMOVE') {
      const oldRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);

      if (amount > 0) {
        //aggregateIncome(oldRecord, -1, -1);
      } else {
        aggregateSpending(oldRecord, 1, -1);
      }
      aggregateSavings(oldRecord, -1);
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