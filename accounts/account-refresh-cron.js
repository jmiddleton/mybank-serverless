const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");
const userbankDao = require("../customer/userbank-auth-dao.js");
const accountsDao = require("../accounts/accounts-dao.js");
const asyncForEach = require("../libs/async-helper").asyncForEach;
const moment = require('moment');

var snsOpts = {
    region: "ap-southeast-2"
};

isOffline = () => process.env.IS_OFFLINE;

if (isOffline()) {
    snsOpts.endpoint = "http://127.0.0.1:4002";
}

let sns = new AWS.SNS(snsOpts);

module.exports.handler = async (event) => {
    const hours = new Number(process.env.SYNC_HOURS);
    const timestamp = moment().subtract(hours, "hours").valueOf();
    let nextKey = undefined;

    console.log("Account refresh cron job started...");
    try {    
        do {
            const userAuths = await userbankDao.getUserBankAuths(timestamp, 100, nextKey);
            console.log(userAuths);
            if (userAuths) {

                nextKey = userAuths.LastEvaluatedKey;
                console.log("Synchronizing " + userAuths.Count + " users...");

                await asyncForEach(userAuths.Items, async auth => {
                    const accounts = await accountsDao.getAccountsByBank(auth.customerId, auth.bank);
                    if (accounts) {
                        await asyncForEach(accounts, async account => {
                            console.log("Refreshing account " + account.accountId);
                            sendSNS(account.accountId, auth);
                        });
                    } else {
                        console.log("Accounts not found.");
                    }
                    //update lastRefreshed so next time is not processed again
                    userbankDao.updateRefreshTime(auth);
                });
            } else {
                nextKey = undefined;
                console.log("Bank authorization token not found");
            }
        } while (nextKey !== undefined);
        console.log("Account refresh cron job completed");

        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};

async function sendSNS(accountId, token) {
    let messageData = {
        Message: JSON.stringify({
            accountId: accountId,
            customerId: token.customerId,
            cdr_url: token.cdr_url,
            bank_code: token.bank,
            access_token: token.access_token
        }),
        TopicArn: process.env.accountsTopicArn,
    };

    console.log("PUBLISHING ACCOUNT MESSAGE TO SNS:", messageData);
    try {
        sns.publish(messageData).promise();
    } catch (err) {
        console.log(err);
    }
}