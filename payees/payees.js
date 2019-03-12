'use strict';

const AWS = require('aws-sdk');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');

const app = express();
const PAYEE_TABLE = process.env.DYNAMODB_TABLE;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.json({ strict: false }));

app.get('/payees2', function (req, res) {
  const params = {
    TableName: PAYEE_TABLE,
    Limit: 500
  };
  
  dynamoDb.scan(params, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not get payees' });
    }

    // create a response
    if (result && result.Items) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      res.json(result.Items);
    } else {
      res.status(404).json({ error: "Payees not found" });
    }
  });
});

// Get Payee endpoint
app.get('/payees2/:payeeId', function (req, res) {
  const params = {
    TableName: PAYEE_TABLE,
    Key: {
      payeeId: req.params.payeeId,
    }
  };

  // fetch payee from the database
  dynamoDb.get(params, (error, result) => {
    // handle potential errors
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not get payee' });
    }

    if (result && result.Item) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      
      res.json(result.Item);
    } else {
      res.status(404).json({ error: "Payee not found" });
    }
  });
});

module.exports.handler = serverless(app);