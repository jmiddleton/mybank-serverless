'use strict';

const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;

/**
 * Get all the accounts of the customer.
 * 
 * @param {Customer Identifier} customerId 
 */
async function getAccounts(customerId) {
  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
    Limit: 100,
    ProjectionExpression: 'accountId, institution, maskedNumber, openStatus, displayName, nickname, productCategory, lastUpdated',
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': customerId
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();
    // create a response
    if (result) {
      return result.Items;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Get account details by customerId and accountId.
 * 
 * @param {Customer Identifier} customerId
 * @param {Account Identifier} accountId
 */
async function getAccountById(customerId, accountId) {

  const params = {
    TableName: process.env.ACCOUNTS_DETAILS_TABLE,
    ProjectionExpression: 'accountId, institution, maskedNumber, openStatus, displayName, nickname, productCategory, bsb, accountNumber, specificAccountUType, depositRates, creditCard, termDeposit, loan',
    Key: {
      customerId: customerId,
      accountId: accountId,
    }
  };

  try {
    let result = await dynamoDb.get(params).promise();

    if (result) {
      return result.Item;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Get account details by customerId and accountId.
 * 
 * @param {Customer Identifier} customerId
 * @param {Bank Identifier} institution
 */
async function getAccountsByBank(customerId, institution) {
  const params = {
    TableName: process.env.ACCOUNTS_TABLE,
    IndexName: 'bankIndex',
    ProjectionExpression: 'accountId, productCategory',
    KeyConditionExpression: 'customerId = :customerId and institution = :institution',
    ExpressionAttributeValues: {
      ':customerId': customerId,
      ':institution': institution
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();

    if (result) {
      return result.Items;
    }
  } catch (error) {
    throw new Error(error.message);
  }
}

// async function deleteAccount(event) {
//   //TODO: send an SNS to functions to delete the data
//   const principalId = event.requestContext.authorizer.principalId;
//   const accountId = event.pathParameters.accountId;

//   deleteAccountById(principalId, accountId);
//   deleteAccountDetails(principalId, accountId);
//   deleteBalance(principalId, accountId);
//   deleteTransactions(principalId, accountId);

//   return jsonResponse.ok({ message: "Account has been successfully deleted" });
// }

// async function deleteAccountById(customerId, accountId) {
//   const params = {
//     TableName: process.env.ACCOUNTS_TABLE,
//     Key: {
//       customerId: customerId,
//       accountId: accountId,
//     }
//   };

//   try {
//     dynamoDb.delete(params).promise();
//     console.log("Account: " + accountId + " successfully deleted");
//   } catch (error) {
//     console.error(error);
//   }
// }

// async function deleteAccountDetails(customerId, accountId) {
//   const params = {
//     TableName: process.env.ACCOUNTS_DETAILS_TABLE,
//     Key: {
//       customerId: customerId,
//       accountId: accountId,
//     }
//   };

//   try {
//     dynamoDb.delete(params).promise();
//     console.log("Account details: " + accountId + " successfully deleted");
//   } catch (error) {
//     console.error(error);
//   }
// }

// async function deleteBalance(customerId, accountId) {
//   const params = {
//     TableName: process.env.BALANCES_TABLE,
//     Key: {
//       customerId: customerId,
//       accountId: accountId,
//     }
//   };

//   try {
//     dynamoDb.delete(params).promise();
//     console.log("Balance for account: " + accountId + " successfully deleted");
//   }catch (error) {
//     console.error(error);
//   }
// }

// async function deleteTransactions(customerId, accountId) {
//   const params = {
//     TableName: process.env.TRANSACTIONS_TABLE,
//     KeyConditionExpression: 'customerId = :customerId and begins_with(accountId, :accountId)',
//     ExpressionAttributeValues: {
//       ':customerId': customerId,
//       ':accountId': accountId,
//     }
//   };

//   try {
//     const transactions = await dynamoDb.query(params).promise();
//     if (transactions && transactions.Items) {
//       await asyncForEach(transactions.Items, async txn => {
//         const txnparams = {
//           TableName: process.env.TRANSACTIONS_TABLE,
//           Key: {
//             customerId: txn.customerId,
//             accountId: txn.accountId,
//           }
//         };
//         await dynamoDb.delete(txnparams).promise();
//       });

//       console.log("Transactions of account: " + accountId + " successfully deleted");
//     }
//   }
//   catch (error) {
//     console.error(error);
//   }
// }

module.exports = {
  getAccountById,
  getAccounts,
  getAccountsByBank
};