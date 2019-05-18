'use strict';

const AWS = require('aws-sdk');
const axios = require("axios");
const asyncForEach = require("../libs/async-helper").asyncForEach;

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

  console.log("Processing Payees event...");

  try {
    const payees = await getPayees(message);

    if (payees) {
      await asyncForEach(payees, async payee => {
        const payeeDetails = await getPayeeDetails(payee, message);
        await updatePayee(payeeDetails, message);
      });
    } else {
      console.log("No Payee found.");
    }
  } catch (err) {
    console.log(err);
  }
};

async function getPayees(message) {
  let records = [];
  let keepGoing = true;
  let page = 1;
  const headers = { Authorization: "Bearer " + message.access_token };

  while (keepGoing) {
    let response = await axios.get(message.cdr_url + "/payees/" + message.bank_code, {
      headers: headers, params: {
        "type": "ALL",
        "page": page,
        "page-size": 10
      }
    });

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
  const headers = { Authorization: "Bearer " + message.access_token };

  try {
    const payeeDetailsResponse = await axios.get(message.cdr_url + "/payees/" + payee.payeeId, {
      headers: headers
    });
    return payeeDetailsResponse ? payeeDetailsResponse.data : undefined;
  }
  catch (error) {
    console.error("Payee: " + payee.payeeId + " not found");
  }
}

async function updatePayee(payee, message) {
  if (!payee) {
    return;
  }

  payee.updated = new Date().getTime();
  payee.customerId = message.customerId;
  const params = {
    TableName: process.env.PAYEES_TABLE,
    Item: payee
  };

  try {
    await dynamoDb.put(params).promise();
    console.log("Payee: " + payee.payeeId + " synched successfully");
  }
  catch (error) {
    console.error(error);
  }
}

