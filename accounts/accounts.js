'use strict';

const AWS = require('aws-sdk');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');

const app = express();
const ACCOUNT_TABLE = process.env.ACCOUNTS_TABLE;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.json({ strict: false }));

app.get('/accounts', function (req, res) {
  const params = {
    TableName: ACCOUNT_TABLE,
    Limit: 500
  };

  dynamoDb.scan(params, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not get account' });
    }

    // create a response
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ error: "Account not found" });
    }
  });
});


// Get account endpoint
app.get('/accounts/:accountId', function (req, res) {
  const params = {
    TableName: ACCOUNT_TABLE,
    Key: {
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
      res.json(result.Item);
    } else {
      res.status(404).json({ error: "Account not found" });
    }
  });
});

app.post('/accounts/:accountId', function (req, res) {
  const timestamp = new Date().getTime();
  const data = JSON.parse(req.body);
  data.created = timestamp;

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

module.exports.handler = serverless(app);