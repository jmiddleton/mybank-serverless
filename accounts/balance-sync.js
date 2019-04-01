'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");
const r2 = require("r2");

const url = "http://localhost:4000/balances";

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();


//Bulk balance - obtain balances for multiple, filtered accounts
module.exports.handler = async (event, context) => {
  const message = event.Records[0].Sns.Message;
  const timestamp = new Date().getTime();
  const account = JSON.parse(message);

  try {
    let response = await r2(url).json;

    if (response && response.data && response.data.balances) {
      response.data.balances.forEach(async balance => {

        balance.updated = timestamp;
        balance.customerId = account.customerId;

        const params = {
          TableName: process.env.BALANCES_TABLE,
          Item: balance
        };

        try {
          let data = await dynamoDb.put(params).promise();
          console.log("Balance for account: " + balance.accountId + " synched successfully");
        } catch (error) {
          console.error(error);
        }
      });
    }
  } catch (err) {
    console.error(error);
  }
};
