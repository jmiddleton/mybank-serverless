'use strict';

const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

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
    if (record.status !== "POSTED") {
      console.log(`Skipping non posted transaction: ${record.transactionId}`);
      continue;
    }

    const aggregatedMonth = record.postingDateTime.substring(0, 7);
    const merchantCode = !record.merchantCategoryCode || record.merchantCategoryCode === "null"
      || record.merchantCategoryCode === null ? 0 : record.merchantCategoryCode;

    const params = {
      TableName: process.env.SPENDING_TABLE,
      Key: {
        customerId: record.customerId,
        month: aggregatedMonth + '-' + merchantCode
      },
      UpdateExpression: 'SET #category = :category, #updated = :updated ADD #totalSpent :amount',
      ExpressionAttributeNames: {
        '#category': 'category',
        '#totalSpent': 'totalSpent',
        '#updated': 'lastUpdated'
      },
      ExpressionAttributeValues: {
        ':category': getMCCDescription(merchantCode),
        ':amount': new Number(record.amount),
        ':updated': new Date().getTime()
      },
      ReturnValues: 'ALL_NEW'
    };

    //Write updates to daily rollup table
    dynamoDb.update(params, (error, result) => {
      if (error) {
        console.error(
          `Internal Error: Error updating dynamoDB record with keys [${JSON.stringify(
            params.Key
          )}] and Attributes [${JSON.stringify(params.ExpressionAttributeValues)}]`
        );
        console.log(error);
        return;
      };
    });
  }
  callback(null, `Successfully processed ${event.Records.length} records.`);
};

//TODO: refactor this method to get the values from DB
function getMCCDescription(code) {

  switch (code) {
    case 4111:
      return "Transport";
      case 4829:
      return "Money Transfer";
    case 5411:
      return "Supermarkets";
    case 5462:
      return "Bakeries";
    case 5139:
      return "Commercial Footwear";
    default:
      return "General";
  }
}