'use strict';

const AWS = require('aws-sdk');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const express = require('express');

const app = express();
const BALANCES_TABLE = process.env.BALANCES_TABLE;
const BASE_PATH = '/cds-au/v1/banking';

var dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000"
},
  isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.json({ strict: false }));

// Get bulk balances endpoint
app.get(BASE_PATH + '/accounts/balances', function (req, res) {
  const params = {
    TableName: BALANCES_TABLE,
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': 'test'
    }
  };

  dynamoDb.query(params, (error, result) => {
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not get balances' });
    }

    if (result && result.Items) {
      const response = {
        data: {
          balances: result.Items
        },
        links: {
          self: "/accounts/balances?page=0",
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
      res.json(response);
    } else {
      res.status(404).json({ error: "Balances not found" });
    }
  });
});

app.post(BASE_PATH + '/internal/balances', function (req, res) {
  const timestamp = new Date().getTime();

  console.log(req);

  const data = req.body;
  data.created = timestamp;
  data.customerId = "test";

  const params = {
    TableName: BALANCES_TABLE,
    Item: data
  };

  dynamoDb.put(params, (error) => {
    if (error) {
      console.error(error);
      res.status(400).json({ error: 'Could not create balance' });
    }

    res.json(params.Item);
  });
});

module.exports.handler = serverless(app);