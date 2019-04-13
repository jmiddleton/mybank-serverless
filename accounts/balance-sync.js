'use strict';

const AWS = require('aws-sdk');
const r2 = require("r2");

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();


//Bulk balance - obtain balances for multiple, filtered accounts
module.exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);

  try {
    let response = await r2(message.cdr_url + "/balances").json;
    if (response && response.data && response.data.balances) {
      response.data.balances.forEach(async balance => {
        await createBalance(balance, message);
      });
    }
  } catch (err) {
    console.error(error);
  }
};

async function createBalance(balance, message) {
  
  balance.updated = new Date().getTime();
  balance.customerId = message.customerId;
  const params = {
    TableName: process.env.BALANCES_TABLE,
    Item: balance
  };
  try {
    let data = await dynamoDb.put(params).promise();
    console.log("Balance for account: " + balance.accountId + " synched successfully");
  }
  catch (error) {
    console.error(error);
  }
}

