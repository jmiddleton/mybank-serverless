'use strict';

const bankclient = require("../libs/bank-client");
const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;

module.exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);
  const timestamp = new Date().getTime();

  console.log("Processing Account Details event...");

  try {
    let response = await bankclient.get(message.cdr_url + "/accounts/" + message.accountId, message);

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
    console.log("-> Error retrieving account details: " + err);
  }
};
