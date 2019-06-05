'use strict';

const moment = require('moment');
const jsonResponse = require("../libs/json-response");
const dynamoDb = require('../libs/dynamodb-helper').dynamoDb;
const _ = require('lodash');

const limit = 6;
const monthFormat = "YYYY-MM";

/**
 * Returns current cashflow: savings, income and spendings of the current month.
 */
module.exports.handler = async (event) => {
  const month = moment().format(monthFormat);
  const principalId = event.requestContext.authorizer.principalId;
  const startMonth = getMonth(month, (-1) * limit);
  const endMonth = getMonth(month, 1);

  const savings = await getSavings(principalId, startMonth);
  const incomes = await getIncomes(principalId, startMonth);
  const spendings = await getSpendings(principalId, startMonth, endMonth);

  return jsonResponse.ok({
    data: {
      savings: savings,
      incomes: incomes,
      spendings: spendings
    }
  });
};

async function getIncomes(principalId, month) {
  const params = {
    TableName: process.env.INCOME_TABLE,
    ProjectionExpression: 'monthName, #month, totalIncome',
    KeyConditionExpression: 'customerId = :customerId AND #month >= :month',
    ExpressionAttributeNames: {
      '#month': 'month'
    },
    ExpressionAttributeValues: {
      ':customerId': principalId,
      ':month': month
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();
    return result.Items;
  } catch (error) {
    console.log(error);
    return {};
  }
};

async function getSavings(principalId, month) {
  const params = {
    TableName: process.env.SAVINGS_TABLE,
    ProjectionExpression: 'monthName, #month, totalSavings',
    KeyConditionExpression: 'customerId = :customerId AND #month >= :month',
    ExpressionAttributeNames: {
      '#month': 'month'
    },
    ExpressionAttributeValues: {
      ':customerId': principalId,
      ':month': month
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();
    return result.Items;
  } catch (error) {
    console.log(error);
    return {};
  }
};

async function getSpendings(principalId, from, to) {
  const params = {
    TableName: process.env.SPENDING_TABLE,
    KeyConditionExpression: 'customerId = :customerId AND #month BETWEEN :startdate AND :enddate',
    ExpressionAttributeNames: {
      '#month': 'month'
    },
    ExpressionAttributeValues: {
      ':customerId': principalId,
      ':startdate': from,
      ':enddate': to
    }
  };

  try {
    let result = await dynamoDb.query(params).promise();

    return _(result.Items)
      .groupBy(spend => spend.month.substring(0, 7))
      .map(function (value, key) {
        return {
          totalSpent: Math.floor(_.sumBy(value, "totalSpent")),
          month: key,
          monthName: getMonthName(key)
        };
      })
      .value();

  } catch (error) {
    console.log(error);
    return {};
  }
};

function getMonth(month, add) {
  if (month) {
    return moment(month, monthFormat).add(add, "months").format(monthFormat);
  }
  return "";
}

function getMonthName(month) {
  if (month) {
    return moment(month, monthFormat).format("MMMM");
  }
  return "";
}