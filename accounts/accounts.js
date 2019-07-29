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

module.exports.handler = async (event) => {
  let handlers = (event["pathParameters"] == null) ? collectionHandlers : methodHandlers;

  let httpMethod = event["httpMethod"];
  if (httpMethod in handlers) {
    const response = await handlers[httpMethod](event);
    return jsonResponse.ok(response);
  }

  return jsonResponse.invalid({ error: `Invalid HTTP Method: ${httpMethod}` });
};

async function getAccounts(event) {
  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
    Limit: 500,
    ProjectionExpression: 'accountId, institution, maskedNumber, openStatus, displayName, nickname, productCategory, lastUpdated',
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': event.requestContext.authorizer.principalId
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();
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
      return body;
    }
    return { error: "Accounts not found" };
  } catch (error) {
    console.log(error);
    return { error: "Error accounts not found" };
  }
}

// Get account details endpoint
async function getAccountById(event) {

  const params = {
    TableName: process.env.ACCOUNTS_DETAILS_TABLE,
    ProjectionExpression: 'accountId, institution, maskedNumber, openStatus, displayName, nickname, productCategory, bsb, accountNumber, specificAccountUType, depositRates, creditCard, termDeposit, loan',
    Key: {
      customerId: event.requestContext.authorizer.principalId,
      accountId: event.pathParameters.accountId,
    }
  };

  try {
    let result = await dynamoDb.get(params).promise();

    // create a response
    if (result && result.Item) {
      return {
        data: result.Item
      };
    }
    return { error: "Account not found" };
  } catch (error) {
    console.log(error);
    return { error: "Error when retrieving an account" };
  }
}

//TODO: check https://www.freecodecamp.org/news/avoiding-the-async-await-hell-c77a0fb71c4c/
async function deleteAccount(event) {
  //TODO: send an SNS to functions to delete the data
  const principalId = event.requestContext.authorizer.principalId;
  const accountId = event.pathParameters.accountId;

  await deleteTransactions(principalId, accountId);
  await deleteBalance(principalId, accountId);
  await deleteAccountById(principalId, accountId);
  await deleteAccountDetails(principalId, accountId);

  return jsonResponse.ok({ message: "Account has been successfully deleted" });
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
    await dynamoDb.delete(params).promise();
    console.log("Account: " + accountId + " successfully deleted");
  } catch (error) {
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
    await dynamoDb.delete(params).promise();
    console.log("Account details: " + accountId + " successfully deleted");
  } catch (error) {
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
    await dynamoDb.delete(params).promise();
    console.log("Balance for account: " + accountId + " successfully deleted");
  }catch (error) {
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
    }else{
      console.log("Transactions to delete not found.");
    }
  }
  catch (error) {
    console.error(error);
  }
}