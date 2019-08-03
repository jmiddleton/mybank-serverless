'use strict';

const AWS = require('aws-sdk');
const bankclient = require("../libs/bank-client");
const asyncForEach = require("../libs/async-helper").asyncForEach;

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

  console.log("Processing Account Balance event...");

  try {
    let response = await bankclient.get(message.cdr_url + "/balances/" + message.bank_code, message);

    if (response && response.data && response.data.data && response.data.data.balances) {
      await asyncForEach(response.data.data.balances, async balance => {
        await updateBalance(balance, message);
      });
    } else {
      console.log("No Balance found.");
    }
  } catch (err) {
    console.log("-> Error retrieving balances: " + err);
  }
};

async function updateBalance(balance, message) {

  balance.updated = new Date().getTime();
  balance.customerId = message.customerId;
  balance.productCategory= message.productCategory;
  
  const params = {
    TableName: process.env.BALANCES_TABLE,
    Item: balance
  };
  try {
    await dynamoDb.put(params).promise();
    console.log("Balance for account: " + balance.accountId + " synched successfully");
  }
  catch (error) {
    console.error(error);
  }
}

