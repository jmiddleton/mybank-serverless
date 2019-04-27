'use strict';

const AWS = require('aws-sdk');
const axios = require("axios");
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
    const headers = { Authorization: "Bearer " + message.access_token };
    let response = await axios.get(message.cdr_url + "/balances", { headers: headers });

    if (response && response.data && response.data.data && response.data.data.balances) {
      asyncForEach(response.data.data.balances, async balance => {
        await updateBalance(balance, message);
      });
    } else {
      console.log("No Balance found.");
    }
  } catch (err) {
    console.log("-> Error retrieving balances: " + err.response.statusText);
  }
};

async function updateBalance(balance, message) {

  balance.updated = new Date().getTime();
  balance.customerId = message.customerId;
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

