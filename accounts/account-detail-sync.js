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

module.exports.handler = async (event, context) => {
  const message = JSON.parse(event.Records[0].Sns.Message);
  const timestamp = new Date().getTime();

  try {
    let response = await r2(message.cdr_url + "/accountDetails/" + message.accountId).json;

    //if (response && response.data) { //this endpoint should return a data element
    if (response) {
      let accountDetail = response;
      accountDetail.updated = timestamp;
      accountDetail.customerId = message.customerId;
      accountDetail.institution = message.bank_code;

      const params = {
        TableName: process.env.ACCOUNTS_DETAILS_TABLE,
        Item: accountDetail
      };

      let data = await dynamoDb.put(params).promise();
      console.log("AccountDetails for account: " + accountDetail.accountId + " synched successfully");
    }
  } catch (error) {
    console.error(error);
  }
};
