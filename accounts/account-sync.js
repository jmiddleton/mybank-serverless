'use strict';

//@deprecated

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");
const r2 = require("r2");

const url = "http://localhost:4000/accounts";

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

  try {
    let response = await r2(url + account.accountId).json;

    if (response && response.data && response.data.balances) {
      response.data.balances.forEach(balance => {

        balance.updated = timestamp;
        balance.customerId = account.customerId;

        const params = {
          TableName: process.env.ACCOUNTS_TABLE,
          Item: balance
        };

        dynamoDb.put(params, (error) => {
          if (error) {
            console.error(error);
            return;
          }
        });
      });
    }
    return jsonResponse.ok({});
  } catch (err) {
    console.log(err);
    return jsonResponse.error();
  }
};
