'use strict';

const AWS = require('aws-sdk');

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = async (event, context) => {
  const message = event.Records[0].Sns.Message;
  const timestamp = new Date().getTime();
  const data = JSON.parse(message);

  data.created = timestamp;
  data.updated = timestamp;
  data.visible = true;

  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
    Item: data
  };

  dynamoDb.put(params, (error) => {
    if (error) {
      console.error(error);
      return;
    }
  });
};
