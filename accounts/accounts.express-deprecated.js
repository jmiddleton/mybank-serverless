'use strict';

const AWS = require('aws-sdk');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');

const app = express();
const ACCOUNT_TABLE = process.env.ACCOUNTS_TABLE;
const ACCOUNTS_DETAILS_TABLE = process.env.ACCOUNTS_DETAILS_TABLE;
const BASE_PATH = '/cds-au/v1/banking/accounts';

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.json({ strict: false }));

// Get all accounts
app.get(BASE_PATH + '/', function (req, res) {

  const params = {
    TableName: ACCOUNT_TABLE,
    Limit: 500,
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': 'test'
    }
  };

  dynamoDb.query(params, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not get account' });
    }

    // create a response
    if (result && result.Items) {
      const response = {
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

      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.json(response);
    } else {
      res.status(404).json({ error: "Account not found" });
    }
  });
});

// Get account details endpoint
app.get(BASE_PATH + '/:accountId', function (req, res) {
  const params = {
    TableName: ACCOUNTS_DETAILS_TABLE,
    Key: {
      customerId: 'test',
      accountId: req.params.accountId,
    }
  };

  // fetch account from the database
  dynamoDb.get(params, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not get accounts' });
    }

    if (result && result.Item) {
      const response = {
        data: result.Item
      }

      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.json(response);
    } else {
      res.status(404).json({ error: "Account not found" });
    }
  });
});

// Create an account 
app.post(BASE_PATH + '/', function (req, res) {
  const timestamp = new Date().getTime();
  const data = req.body;
  data.created = timestamp;
  data.customerId = req.apiGateway ? req.apiGateway.event.requestContext.authorizer.principalId : "test";

  const params = {
    TableName: ACCOUNT_TABLE,
    Item: data
  };

  // write the account to the database
  dynamoDb.put(params, (error) => {
    // handle potential errors
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not create the account' });
    }

    // create a response
    res.json(params.Item);
  });
});

// Create account details
app.post(BASE_PATH + '/:accountId', function (req, res) {
  const timestamp = new Date().getTime();
  const data = req.body;
  data.created = timestamp;
  data.customerId = req.apiGateway ? req.apiGateway.event.requestContext.authorizer.principalId : "test";
  data.accountId = req.params.accountId

  const params = {
    TableName: ACCOUNTS_DETAILS_TABLE,
    Item: data
  };

  console.log("JORGE: " + params.Item.customerId);

  // write the account to the database
  dynamoDb.put(params, (error) => {
    // handle potential errors
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not create the account' });
    }

    // create a response
    res.json(params.Item);
  });
});

module.exports.handler = serverless(app);