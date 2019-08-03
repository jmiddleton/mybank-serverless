'use strict';

const bankclient = require("../libs/bank-client");
const asyncForEach = require("../libs/async-helper").asyncForEach;
const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;

module.exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);
  let page = 1;

  console.log("Processing Scheduled Payments event...");

  try {
    const params = {
      "page": page,
      "page-size": 25,
      "_page": page
    };

    let response = await bankclient.get(message.cdr_url + "/accounts/" + message.accountId + "/payments/scheduled",
      message, params);

    if (response && response.data && response.data.data && response.data.data.scheduledPayments) {
      await asyncForEach(response.data.data.scheduledPayments, async payment => {
        await updatePayment(payment, message);
      });
    } else {
      console.log("No Scheduled Payment found.");
    }
  } catch (err) {
    console.log("-> Error retrieving Scheduled Payment: " + err);
  }
};

async function updatePayment(payment, message) {

  payment.updated = new Date().getTime();
  payment.customerId = message.customerId;
  payment.accountId = message.accountId + "#" + payment.scheduledPaymentId;

  const params = {
    TableName: process.env.SCHEDULED_PAYMENTS_TABLE,
    Item: payment
  };
  try {
    await dynamoDb.put(params).promise();
    console.log("Scheduled Payment for account: " + payment.accountId + " synched successfully");
  }
  catch (error) {
    console.error(error);
  }
}

