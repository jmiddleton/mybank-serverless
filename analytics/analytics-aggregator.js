'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const moment = require('moment');

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = (event, context, callback) => {

  //trim down to just "INSERT" events
  const insertRecords = event.Records.filter(record => record.eventName === 'INSERT');
  // Unnmarshall records them to plain JSON objects
  const unmarshalledRecords = insertRecords.map(record =>
    AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage)
  );

  for (let record of unmarshalledRecords) {
    //TODO: synch would be better
    aggregateSpending(record);
    aggregateSavings(record);

  }
  callback(null, `Successfully processed ${event.Records.length} records.`);
};

function aggregateSpending(record) {
  const amount = new Number(record.amount);

  //credit doesn't count as spending.
  if (amount >= 0) {
    return;
  }

  const aggregatedMonth = record.valueDateTime.substring(0, 7);
  const category= getMCCDescription(record);

  const params = {
    TableName: process.env.SPENDING_TABLE,
    Key: {
      customerId: record.customerId,
      month: aggregatedMonth + '#' + category
    },
    UpdateExpression: 'SET #category = :category, #updated = :updated ADD #totalSpent :amount, #totalOfTrans :sumOfTrans',
    ExpressionAttributeNames: {
      '#category': 'category',
      '#totalSpent': 'totalSpent',
      '#updated': 'lastUpdated',
      '#totalOfTrans': 'totalOfTrans'
    },
    ExpressionAttributeValues: {
      ':category': category,
      ':amount': amount,
      ':updated': new Date().getTime(),
      ':sumOfTrans': 1
    },
    ReturnValues: 'ALL_NEW'
  };

  //Write updates to daily rollup table
  dynamoDb.update(params, (error, result) => {
    console.log(result);
    if (error) {
      console.error(
        `Internal Error: Error updating spendings record with keys [${JSON.stringify(
          params.Key
        )}] and Attributes [${JSON.stringify(params.ExpressionAttributeValues)}]`
      );
      console.log(error);
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
    console.log(result);
    if (error) {
      console.error(
        `Internal Error: Error updating savings record with keys [${JSON.stringify(
          params.Key
        )}] and Attributes [${JSON.stringify(params.ExpressionAttributeValues)}]`
      );
      console.log(error);
      return;
    };
  });
}

//TODO: refactor this method to get the values from DB

const categories = [
  { "name": "Groceries", "codes": ["5462", "5411"] },
  { "name": "Transport", "codes": ["4111", "0661"] },
  { "name": "Shopping", "codes": ["5139", "5661"] },
  { "name": "Cash", "codes": ["4829"] },
];

function getMCCDescription(record) {
  var result;
  
  const merchantCode = record.merchantCategoryCode;
  if(merchantCode){
    result = categories.find(category => category.codes.find(code => code === merchantCode));
  }

  if(result){
    return result.name;
  }
  return "uncategorised";
}

function getMonthName(month) {
  if (month) {
    return moment(month, "YYYY-MM").format("MMMM");
  }
  return "";
}