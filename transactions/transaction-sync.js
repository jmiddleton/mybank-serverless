'use strict';

const AWS = require('aws-sdk');
const bankclient = require("../libs/bank-client");
const shortid = require('shortid');
const mcccodes = require("../category/mcccodes.js");
const externalClient = require("../category/truelocal-client.js");
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

  console.log("Processing Account Transactions event...");

  try {
    const transactions = await getTransactions(message);
    const hasTransactions = transactions.length > 0;
    console.log("Found " + transactions.length + " transactions to process: ");

    if (hasTransactions) {
      await asyncForEach(transactions, async txn => {
        const validDate = getValidDate(txn);
        let id = txn.accountId + "#" + validDate + "#" + (txn.transactionId ? txn.transactionId : shortid.generate());

        txn.created = validDate;
        txn.customerId = message.customerId;
        txn.category = await getCategory(txn);
        txn.accountFilter = txn.accountId + "#" + txn.category + "#" + validDate;
        txn.accountId = id;

        const params = {
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: clean(txn)
        };

        try {
          await dynamoDb.put(params).promise();
          console.log("Transactions " + txn.accountFilter + " processed successfully.");
        } catch (error) {
          console.error(error);
        }
      });
    } else {
      console.log("No Transactions found.");
    }
  } catch (err) {
    console.log(err);
  }
  console.log("Transactions processing finished.");
};

async function getTransactions(message) {
  let records = [];
  let keepGoing = true;
  let page = 1;

  while (keepGoing) {
    let params = {
      'accountId': message.accountId,
      'oldest-time': moment().subtract(3, 'months').format(),
      'newest-time': moment().format(),
      "page": page,
      "page-size": 25,
      "_page": page
    };

    let response = await bankclient.get(message.cdr_url + "/accounts/" + message.accountId + "/transactions",
      message, params);

    //TODO: this is for openbanking
    // if (response && response.data && response.data.data && response.data.data.transactions) {
    //   response.data.data.transactions.forEach(p => {
    //     records.push(p);
    //   });

    if (response && response.data && response.data.length > 0) {
      response.data.forEach(p => {
        p.institution = message.bank_code;
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
 *       si no buscar en truelocal usando el merchantName y guardarlo en la tabla merchant-categories.
 * 
 *    si no hay merchant, ver si hay merchantCategoryCode:
 *       si hay merchantCategoryCode, buscarlo en MCCCodes tabla
 *    si no buscar la description en truelocal y guardarlo en la tabla merchant-categories.
 *    si no se encuentra nada, retornar Uncategorized
 * @param {*} txn 
 */

const transactionTypes = new Map();
transactionTypes.set("FEE", "FeesAndInterest");
transactionTypes.set("INTEREST_CHARGED", "FeesAndInterest");
transactionTypes.set("INTEREST_PAID", "Income");
transactionTypes.set("TRANSFER_OUTGOING", "Transfers");
transactionTypes.set("TRANSFER_INCOMING", "Transfers");
transactionTypes.set("DIRECT_DEBIT", "Uncategorized");
transactionTypes.set("OTHER", "Uncategorized");

async function getCategory(txn) {
  let category;
  const merchantName = txn.merchantName;
  const merchantCategoryCode = txn.merchantCategoryCode;

  const type = transactionTypes.get(txn.type);
  if (type) {
    //TODO: ver si hay algun mapeo de la description primero, sino devolver el default
    const merchantCategory = await mcccodes.getCategoryByKey(txn.description);
    if (merchantCategory) {
      return merchantCategory.category;
    }
    return type;
  }

  try {

    if (merchantCategoryCode) {
      const mcccode = await mcccodes.getMCCCategoryByCode(merchantCategoryCode);
      if (mcccode) {
        category = mcccode.category;
      }
    } else {
      if (merchantName) {
        category = await getCategoryByMerchantName(merchantName);
      } else {
        category = await getCategoryByKeyword(txn.description);
      }
    }

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
    //TODO: split the keyword by space and search each word in dynamodb
    //once found, add it.
    const merchantCategory = await mcccodes.getCategoryByKey(merchantName);
    if (merchantCategory) {
      return merchantCategory.category;
    }

    return await getCategoryByKeyword(merchantName);

  } catch (err) {
    console.log("Error finding category by merchant name.");
    console.log(err);
  }
}

//buscar en truelocal
async function getCategoryByKeyword(keyword) {
  try {
    const categoryFound = await externalClient.search(keyword);
    return await createKeywordCategory(categoryFound, keyword);
  } catch (err) {
    console.log("Error finding category by " + keyword);
    console.log(err);
  }
}

async function createKeywordCategory(categoryFound, keyword) {
  if (categoryFound) {

    const category = await mcccodes.getCategoryByCode(categoryFound);
    if (category) {
      mcccodes.addKeywordCategory({
        keyword: keyword,
        category: category.parent,
        subcategory: categoryFound
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