'use strict';

const AWS = require('aws-sdk');
const axios = require("axios");
const shortid = require('shortid');
const mcccodes = require("../category/mcccodes.js");
const asyncForEach = require("../libs/async-helper").asyncForEach;
const clean = require('obj-clean');

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

  console.log("Processing Account Transactions event...");

  try {
    const headers = { Authorization: "Bearer " + message.access_token };
    //TODO: use this with real endpoint 
    //let response = await axios.get(message.cdr_url + "/accounts/" + message.accountId + "/transactions", { headers: headers });
    let response = await axios.get(message.cdr_url + "/transactions/" + message.accountId, { headers: headers });

    const hasTransactions = response !== undefined && response.data !== undefined && response.data.data !== undefined && response.data.data.transactions !== undefined;
    console.log("Found transactions to process: " + hasTransactions);

    if (hasTransactions) {
      await asyncForEach(response.data.data.transactions, async txn => {
        const validDate = getValidDate(txn);
        let id = txn.accountId + "#" + validDate + "#" + (txn.transactionId ? txn.transactionId : shortid.generate());
        console.log("Processing txn: " + id);

        txn.updated = timestamp;
        txn.customerId = message.customerId;
        txn.category = await getCategory(txn);
        txn.categoryFilter = txn.category + "#" + validDate.substring(0, 7);
        txn.accountFilter = txn.accountId + "#" + txn.categoryFilter;
        txn.accountId = id;

        const params = {
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: clean(txn)
        };

        try {
          await dynamoDb.put(params).promise();
          console.log("Txn: " + id + " synched successfully");
        } catch (error) {
          console.error(error);
        }
      });
    } else {
      console.log(JSON.stringify(response));
      console.log("No Transactions found.");
    }
  } catch (err) {
    console.log(err);
    console.log("-> Error retrieving transactions: ");
  }
  console.log("Transactions processing finished.");
};

async function getCategory(record) {
  const merchantCode = record.merchantCategoryCode;
  if (merchantCode) {
    try {
      const dbCategory = await mcccodes.getMCCCategoryByCode(merchantCode);
      if (dbCategory) {
        return dbCategory.category;
      }
    } catch (err) {
      console.log("Error retrieving MCC codes: " + err.response.statusText);
      console.log(err);
    }
  }
  return "Uncategorized";
}

function getValidDate(txn) {
  if (txn.postingDateTime && txn.postingDateTime != null && txn.postingDateTime != "null") {
    return txn.postingDateTime;
  }

  if (txn.valueDateTime) {
    return txn.valueDateTime;
  }
  return moment().format();
}