'use strict';

const bankclient = require("../libs/bank-client");
const asyncForEach = require("../libs/async-helper").asyncForEach;
const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;

module.exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);
  let page = 1;

  console.log("Processing Direct Debits event...");

  try {
    const params = {
      "page": page,
      "page-size": 25,
      "_page": page
    };

    let response = await bankclient.get(message.cdr_url + "/accounts/" + message.accountId + "/direct-debits",
      message, params);

    if (response && response.data && response.data.data && response.data.data.directDebitAuthorisations) {
      await asyncForEach(response.data.data.directDebitAuthorisations, async directDebit => {
        await updateDirectDebit(directDebit, message);
      });
    } else {
      console.log("No Direct Debits found.");
    }
  } catch (err) {
    console.log("-> Error retrieving Direct Debits: " + err);
  }
};

async function updateDirectDebit(directDebit, message) {

  directDebit.updated = new Date().getTime();
  directDebit.customerId = message.customerId;
  directDebit.accountId = message.accountId + "#" + directDebit.authorisedEntity.description;

  const params = {
    TableName: process.env.DIRECT_DEBITS_TABLE,
    Item: directDebit
  };
  try {
    await dynamoDb.put(params).promise();
    console.log("Direct Debit for account: " + directDebit.accountId + " synched successfully");
  }
  catch (error) {
    console.error(error);
  }
}

