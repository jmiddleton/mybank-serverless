'use strict';

const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");
const userbankDao = require("../customer/userbank-auth-dao.js");
const asyncForEach = require("../libs/async-helper").asyncForEach;
const dynamoDbHelper = require('../libs/dynamodb-helper');
const bankclient = require("../libs/bank-client");
const log4js = require('log4js');
const logger = log4js.getLogger('link-accounts');
logger.level = 'debug';

const dynamoDb = dynamoDbHelper.dynamoDb;

var snsOpts = {
    region: "ap-southeast-2"
};

if (dynamoDbHelper.isOffline()) {
    snsOpts.endpoint = "http://127.0.0.1:4002";
}

let sns = new AWS.SNS(snsOpts);

module.exports.handler = async (event) => {
    const data = JSON.parse(event.body);
    const principalId = event.requestContext.authorizer.principalId;

    try {
        const userBankAuth = await userbankDao.registerUserBankAuth(data, principalId);
        if (userBankAuth) {
            const accounts = await getAccounts(userBankAuth);
            await asyncForEach(accounts, async account => {
                const status = await registerAccount(account, userBankAuth);
                if (status == 0) {
                    await publishAccountLinked(account, userBankAuth);
                }
            });
        } else {
            return jsonResponse.error({ error: "Failure to retrieve user authorization" });
        }

        return jsonResponse.ok({});
    } catch (err) {
        logger.error(err);
        return jsonResponse.error(err);
    }
};

async function getAccounts(token) {
    //TODO: for real openbanking API, replace banks for accounts
    const accounts = await bankclient.get(token.cdr_url + "/banks/" + token.bank, token);
    if (accounts && accounts.data && accounts.data.data && accounts.data.data.accounts) {
        return accounts.data.data.accounts;
    }
    return [];
}

async function publishAccountLinked(account, token) {
    logger.debug(token);
    let messageData = {
        Message: JSON.stringify({
            accountId: account.accountId,
            productCategory: account.productCategory,
            customerId: token.customerId,
            cdr_url: token.cdr_url,
            bank_code: token.bank,
            access_token: token.access_token,
            consent_duration: token.consent_duration,
            consent_scopes: token.consent_scopes
        }),
        TopicArn: process.env.accountsTopicArn,
    };

    logger.debug("PUBLISHING ACCOUNT MESSAGE TO SNS:", messageData);
    try {
        let snsResult = await sns.publish(messageData).promise();
        logger.debug("PUBLISHED", snsResult);
    } catch (err) {
        logger.error(err);
    }
}

async function registerAccount(account, token) {
    const timestamp = new Date().getTime();
    account.customerId = token.customerId;
    account.lastUpdated = timestamp;
    account.visible = true;
    account.institution = token.bank;

    const params = {
        TableName: process.env.ACCOUNTS_TABLE,
        Item: account
    };

    try {
        await dynamoDb.put(params).promise();
        logger.debug("Account: " + account.accountId + " synched successfully");
        return 0;
    } catch (error) {
        logger.error(error);
        return -1;
    }
}