'use strict';

const AWS = require('aws-sdk');
const axios = require("axios");
const shortid = require('shortid');
const mcccodes = require("../category/mcccodes.js");
const trueLocal = require("../category/true-local-client.js");
const asyncForEach = require("../libs/async-helper").asyncForEach;
const clean = require('obj-clean');
const moment = require('moment');

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
    const transactions = await getTransactions(message);
    const hasTransactions = transactions.length > 0;
    console.log("Found " + transactions.length + " transactions to process: ");

    if (hasTransactions) {
      await asyncForEach(transactions, async txn => {
        const validDate = getValidDate(txn);
        let id = txn.accountId + "#" + validDate + "#" + (txn.transactionId ? txn.transactionId : shortid.generate());

        txn.updated = timestamp;
        txn.customerId = message.customerId;
        txn.category = await getCategory(txn);
        txn.categoryFilter = txn.category + "#" + validDate;
        txn.accountFilter = txn.accountId + "#" + txn.categoryFilter;
        txn.accountId = id;

        const params = {
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: clean(txn)
        };

        try {
          dynamoDb.put(params).promise();
        } catch (error) {
          console.error(error);
        }
      });
    } else {
      console.log(JSON.stringify(transactions));
      console.log("No Transactions found.");
    }
  } catch (err) {
    console.log(err);
    console.log("-> Error retrieving transactions: ");
  }
  console.log("Transactions processing finished.");
};

async function getTransactions(message) {
  let records = [];
  let keepGoing = true;
  let page = 1;
  const headers = { Authorization: "Bearer " + message.access_token };

  while (keepGoing) {
    //TODO: use this with real endpoint 
    //let response = await axios.get(message.cdr_url + "/accounts/" + message.accountId + "/transactions", { headers: headers });
    let response = await axios.get(message.cdr_url + "/transactions", {
      headers: headers, params: {
        'accountId': message.accountId,
        'start-time': moment().subtract(3, 'months').format(),
        'end-time': moment().format(),
        "page": page,
        "page-size": 25,
        "_page": page
      }
    });

    //TODO: this is for openbanking
    // if (response && response.data && response.data.data && response.data.data.transactions) {
    //   response.data.data.transactions.forEach(p => {
    //     records.push(p);
    //   });

    if (response && response.data && response.data.length > 0) {
      response.data.forEach(p => {
        records.push(p);
      });
    } else {
      keepGoing = false;
      return records;
    }
    page += 1;

    //TODO: this is for openbanking
    // if (!(response && response.meta && response.meta.totalPages)) {
    //   keepGoing = false;
    //   return records;
    // }

    // if (response.meta.totalPages > offset) {
    //   keepGoing = false;
    //   return records;
    // }
  }
}

/**
 * Dependiendo del tipo, ejecutar lo siguiente:
 * 
 * .- type 	FEE mapear a FeesAndInterest
 * .- type 	INTEREST_CHARGED mapear a FeesAndInterest
 * .- type 	INTEREST_PAID mapear a Income
 * .- type 	TRANSFER_OUTGOING mapear a Transfer
 * .- type 	TRANSFER_INCOMING mapear a Transfer
 * .- type 	DIRECT_DEBIT mapear a Uncategorized
 * .- type 	OTHER mapear a Uncategorized
 * 
 * .- type 	PAYMENT (ejecutar la siguiente logica):
 *    si hay merchant name:
 *       primero ver si esta en la tabla merchant-categories,
 *       sino buscar en truelocal usando el merchantName y guardarlo en la tabla merchant-categories.
 * 
 *    sino hay merchant, ver si hay merchantCategoryCode:
 *       si hay merchantCategoryCode, buscarlo en MCCCodes tabla
 *    sino buscar la description en truelocal y guardarlo en la tabla merchant-categories.
 *    si no se encuentra nada, retornar Uncategorized
 * @param {*} txn 
 */
async function getCategory(txn) {
  let category;
  const merchantName = txn.merchantName;

  if (txn.type !== "PAYMENT") {
    return "Uncategorized";
  }

  try {
    if (merchantName) {
      console.log(">>>>>>>>>m " + merchantName);
      category = await getCategoryByMerchantName(merchantName);
    } else {
      console.log(">>>>>>>>>d " + txn.description);
      category = await getCategoryByDescription(txn.description);
    }

    console.log(">>>>>>>>>cat " + category);
    if (category) {
      return category;
    }
  } catch (err) {
    console.log("Error retrieving category: " + err.response);
    console.log(err);
  }
  return "Uncategorized";
}

async function getCategoryByMerchantName(merchantName) {
  try {
    const merchantCategory = await mcccodes.getMerchantCategory(merchantName);
    console.log(">>>>>>>>>mc " + merchantCategory);
    if (merchantCategory) {
      return merchantCategory.category;
    }

    //buscar en truelocal
    const trueLocalResponse = await trueLocal.search(merchantName, merchantName);
    console.log(">>>>>>>>>tl " + trueLocalResponse.category);

    if (trueLocalResponse) {
      return await processCategory(trueLocalResponse, merchantName);
    }
  } catch (err) {
    console.log("Error finding category by merchant name.");
    console.log(err);
  }
  return undefined;
}

async function getCategoryByDescription(description) {
  try {
    //buscar en truelocal
    const trueLocalResponse = await trueLocal.search(description);
    if (trueLocalResponse) {
      return await processCategory(trueLocalResponse, description);
    }
  } catch (err) {
    console.log("Error finding category by description.");
    console.log(err);
  }
  return undefined;
}

async function processCategory(trueLocalResponse, merchantName) {
  if (trueLocalResponse && trueLocalResponse.category) {

    const category = await mcccodes.getCategoryByCode(trueLocalResponse.category);
    if (category) {
      mcccodes.addMerchantCategory({
        merchantName: merchantName,
        category: category.parent,
        subcategory: trueLocalResponse.category
      });
      return category.parent;
    }
  }
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