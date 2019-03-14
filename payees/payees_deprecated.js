'use strict';

const AWS = require('aws-sdk');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');

const app = express();
const PAYEE_TABLE = process.env.PAYEES_TABLE;
const BASE_PATH = '/cds-au/v1/banking/payees';

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
: new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.json({ strict: false }));

// Get all payees of a customer
app.get(BASE_PATH+'/', function (req, res) {
  let principal = req.requestContext.authorizer.principalId;

  const params = {
    TableName: PAYEE_TABLE,
    Limit: 500,
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': principal
    }
  };
  
  dynamoDb.query(params, (error, result) => {
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

// Get Payee details
app.get(BASE_PATH+'/:payeeId', function (req, res) {
  let principal = req.requestContext.authorizer.principalId;

  const params = {
    TableName: PAYEE_TABLE,
    Key: {
      customerId: principal,
      payeeId: req.params.payeeId
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