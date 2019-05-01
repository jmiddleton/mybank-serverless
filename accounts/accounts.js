'use strict';

const AWS = require('aws-sdk');
const jsonResponse = require("../libs/json-response");
const asyncForEach = require("../libs/async-helper").asyncForEach;

const collectionHandlers = {
  "GET": getAccounts
}
const methodHandlers = {
  "GET": getAccountById,
  "DELETE": deleteAccount
}

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

module.exports.handler = (event, context, callback) => {
  let handlers = (event["pathParameters"] == null) ? collectionHandlers : methodHandlers;

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    return handlers[httpMethod](event, callback);
  }

  callback(null, jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` }));
};

function getAccounts(event, callback) {
  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
    Limit: 500,
    ProjectionExpression: 'accountId, institution, maskedNumber, openStatus, displayName, productCategory',
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId
    }
  };

  dynamoDb.query(params, (error, result) => {
    if (error) {
      callback(null, jsonResponse.notFound({ error: "Couldn\'t find accounts" }));
      return;
    }

    // create a response
    if (result && result.Items && result.Items.length > 0) {
      const body = {
        data: {
          accounts: result.Items
        },
        links: {
          self: "/accounts?page=0",
          first: "",
          prev: "",
          next: "",
          last: ""
        },
        meta: {
          totalRecords: result.Items.length,
          totalPages: 1
        }
      }

      callback(null, jsonResponse.ok(body));
    } else {
      callback(null, jsonResponse.notFound({
        error: "Accounts not found"
      }));
    }
  });
}

// Get account details endpoint
function getAccountById(event, callback) {

  const params = {
    TableName: process.env.ACCOUNTS_DETAILS_TABLE,
    ProjectionExpression: 'accountId, institution, maskedNumber, openStatus, displayName, productCategory, bsb, accountNumber, specificAccountUType, depositRates, creditCard, termDeposit',
    Key: {
      customerId: event.requestContext.authorizer.principalId,
      accountId: event.pathParameters.accountId,
    }
  };

  dynamoDb.get(params, (error, result) => {
    if (error) {
      callback(null, jsonResponse.notFound({
        error: "Could not get accounts"
      }));
      return;
    }

    // create a response
    if (result && result.Item) {
      const data = {
        data: result.Item
      }

      callback(null, jsonResponse.ok(data));
    } else {
      callback(null, jsonResponse.notFound({
        error: "Accounts not found"
      }));
    }
  });
}

async function deleteAccount(event, callback) {
  //TODO: send an SNS to functions to delete the data
  const principalId = event.requestContext.authorizer.principalId;
  const accountId = event.pathParameters.accountId;

  deleteAccountById(principalId, accountId);
  deleteAccountDetails(principalId, accountId);
  deleteBalance(principalId, accountId);
  deleteTransactions(principalId, accountId);

  callback(null, jsonResponse.ok({ message: "Account has been successfully deleted" }));
}


async function deleteAccountById(customerId, accountId) {
  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
    Key: {
      customerId: customerId,
      accountId: accountId,
    }
  };

  try {
    dynamoDb.delete(params).promise();
    console.log("Account: " + accountId + " successfully deleted");
  }
  catch (error) {
    console.error(error);
  }
}

async function deleteAccountDetails(customerId, accountId) {
  const params = {
    TableName: process.env.ACCOUNTS_DETAILS_TABLE,
    Key: {
      customerId: customerId,
      accountId: accountId,
    }
  };

  try {
    dynamoDb.delete(params).promise();
    console.log("Account details: " + accountId + " successfully deleted");
  }
  catch (error) {
    console.error(error);
  }
}

async function deleteBalance(customerId, accountId) {
  const params = {
    TableName: process.env.BALANCES_TABLE,
    Key: {
      customerId: customerId,
      accountId: accountId,
    }
  };

  try {
    dynamoDb.delete(params).promise();
    console.log("Balance for account: " + accountId + " successfully deleted");
  }
  catch (error) {
    console.error(error);
  }
}

async function deleteTransactions(customerId, accountId) {
  const params = {
    TableName: process.env.TRANSACTIONS_TABLE,
    KeyConditionExpression: 'customerId = :customerId and begins_with(accountId, :accountId)',
    ExpressionAttributeValues: {
      ':customerId': customerId,
      ':accountId': accountId,
    }
  };

  try {
    const transactions = await dynamoDb.query(params).promise();
    if (transactions && transactions.Items) {
      await asyncForEach(transactions.Items, async txn => {
        const txnparams = {
          TableName: process.env.TRANSACTIONS_TABLE,
          Key: {
            customerId: txn.customerId,
            accountId: txn.accountId,
          }
        };
        await dynamoDb.delete(txnparams).promise();
      });

      console.log("Transactions of account: " + accountId + " successfully deleted");
    }
  }
  catch (error) {
    console.error(error);
  }
}