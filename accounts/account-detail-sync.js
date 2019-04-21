'use strict';

const AWS = require('aws-sdk');
const axios = require("axios");

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
    const headers = { Authorization: "Bearer " + message.access_token };
    let response = await axios.get(message.cdr_url + "/accountDetails/" + message.accountId, { headers: headers });

    //if (response && response.data) { //this endpoint should return a data element
    if (response && response.data && response.data.accountId) {
      let accountDetail = response.data;
      accountDetail.updated = timestamp;
      accountDetail.customerId = message.customerId;
      accountDetail.institution = message.bank_code;

      const params = {
        TableName: process.env.ACCOUNTS_DETAILS_TABLE,
        Item: accountDetail
      };

      await dynamoDb.put(params).promise();
      console.log("AccountDetails for account: " + accountDetail.accountId + " synched successfully");
    } else {
      console.log("No Account Details found.");
    }
  } catch (err) {
    console.log("-> Error retrieving account details: " + err.response.statusText);
  }
};
