'use strict';

const AWS = require('aws-sdk');
const r2 = require('r2');

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

var snsOpts = {
  region: "ap-southeast-2"
};

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

if (isOffline()) {
  snsOpts.endpoint = "http://127.0.0.1:4002";
}

let sns = new AWS.SNS(snsOpts);

module.exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);

  try {
    let response = await r2(message.cdr_url + "/accounts").json;

    if (response && response.data && response.data.accounts) {
      response.data.accounts.forEach(account => {
        registerAccount(account, message.customerId);
        sendSNS(account, message);
      });
    }
  } catch (err) {
    console.error(error);
  }
};

async function sendSNS(account, message) {
  let messageData = {
    Message: JSON.stringify({
      accountId: account.accountId,
      customerId: message.customerId,
      cdr_url: message.cdr_url,
      bank_code: message.code,
      token_id: message.token_id
    }),
    TopicArn: process.env.accountsTopicArn,
  };

  console.log("PUBLISHING ACCOUNT MESSAGE TO SNS:", messageData);
  try {
    sns.publish(messageData).promise();
  } catch (err) {
    console.log(err);
  }
}

async function registerAccount(account, customerId) {
  const timestamp = new Date().getTime();
  account.customerId = customerId;
  account.created = timestamp;
  account.updated = timestamp;
  account.visible = true;

  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
    Item: account
  };

  try {
    await dynamoDb.put(params).promise();
    console.log("Account: " + account.accountId + " synched successfully");
  } catch (error) {
    console.error(error);
  }
}
