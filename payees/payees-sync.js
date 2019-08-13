'use strict';

const AWS = require('aws-sdk');
const axios = require("axios");
const asyncForEach = require("../libs/async-helper").asyncForEach;
const bankclient = require("../libs/bank-client");
const log4js = require('log4js');
const logger = log4js.getLogger('payees-sync');
logger.level = 'debug';

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

  logger.debug("Processing Payees event...");

  try {
    const payees = await getPayees(message);

    if (payees) {
      await asyncForEach(payees, async payee => {
        const payeeDetails = await getPayeeDetails(payee, message);
        await updatePayee(payeeDetails, message);
      });
    } else {
      logger.debug("No Payee found.");
    }
  } catch (err) {
    logger.error(err);
  }
};

async function getPayees(message) {
  let records = [];
  let keepGoing = true;
  let page = 1;

  while (keepGoing) {
    let params = {
      "type": "ALL",
      "page": page,
      "page-size": 25
    };

    let response = await bankclient.get(message.cdr_url + "/payees/" + message.bank_code, message, params);

    if (response && response.data && response.data.payees) {
      response.data.payees.forEach(p => {
        records.push(p);
      });
    }
    page += 1;
    if (!response || !response.meta || !response.meta.totalPages) {
      keepGoing = false;
      return records;
    }

    if (response.meta.totalPages > offset) {
      keepGoing = false;
      return records;
    }
  }
}

async function getPayeeDetails(payee, message) {

  try {
    const payeeDetailsResponse = await axios.get(message.cdr_url + "/payees/" + payee.payeeId, message);
    return payeeDetailsResponse ? payeeDetailsResponse.data : undefined;
  } catch (error) {
    logger.error("Payee: " + payee.payeeId + " not found");
  }
}

async function updatePayee(payee, message) {
  if (!payee) {
    return;
  }

  payee.updated = new Date().getTime();
  payee.customerId = message.customerId;
  payee.institution = message.bank_code;

  const params = {
    TableName: process.env.PAYEES_TABLE,
    Item: payee
  };

  try {
    await dynamoDb.put(params).promise();
    logger.debug("Payee: " + payee.payeeId + " synched successfully");
  }
  catch (error) {
    logger.error(error);
  }
}

