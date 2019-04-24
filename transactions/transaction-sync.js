'use strict';

const AWS = require('aws-sdk');
const axios = require("axios");
const shortid = require('shortid');
const mcccodes = require("../category/mcccodes.js");

//TODO: use const clean = require('obj-clean'); to remove empty elements not allowed by dynamoDB.

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);
  const timestamp = new Date().getTime();

  try {
    const headers = { Authorization: "Bearer " + message.access_token };
    let response = await axios.get(message.cdr_url + "/accounts/" + message.accountId + "/transactions", { headers: headers });

    if (response && response.data && response.data.data && response.data.data.transactions) {
      response.data.data.transactions.forEach(async txn => {

        let id = txn.accountId + "#" + txn.valueDateTime + "#" + (txn.transactionId ? txn.transactionId : shortid.generate());
        txn.updated = timestamp;
        txn.customerId = message.customerId;
        txn.accountId = id;
        txn.category = await getCategory(txn);

        const params = {
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: txn
        };

        try {
          let data = await dynamoDb.put(params).promise();
          console.log("Transactions for account: " + txn.accountId + " synched successfully");
        } catch (error) {
          console.error(error);
        }
      });
    } else {
      console.log("No Transactions found.");
    }
  } catch (err) {
    console.log("-> Error retrieving transactions: " + err.response.statusText);
  }
};

async function getCategory(record) {
  const merchantCode = record.merchantCategoryCode;
  if (merchantCode) {
    const categoryPromise = mcccodes.getMCCCategoryByCode(merchantCode);
    const dbCategory = await categoryPromise;

    if (dbCategory) {
      return dbCategory.category;
    }
  }
  return "Uncategorized";
}
