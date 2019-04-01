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
  const account = JSON.parse(message);

  account.created = timestamp;
  account.updated = timestamp;
  account.visible = true;

  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
    Item: account
  };

  try {
    let data = await dynamoDb.put(params).promise();
    console.log("Account " + account.accountId + " synched successfully");
  } catch (error) {
    console.error(error);
  }
};
