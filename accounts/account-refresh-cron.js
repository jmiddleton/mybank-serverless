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
    let nextKey = undefined;
    const timestamp = getSyncRefreshTimestamp();

    console.log("Account refresh cron job started, scanning for users not refreshed before " + moment(timestamp).format());
    try {
        do {
            const userAuths = await userbankDao.getUserBankAuths(timestamp, 100, nextKey);

            if (userAuths) {
                nextKey = userAuths.LastEvaluatedKey;
                console.log("Synchronizing " + userAuths.Count + " users...");

                await asyncForEach(userAuths.Items, async auth => {
                    const accounts = await accountsDao.getAccountsByBank(auth.customerId, auth.bank);
                    if (accounts) {
                        await asyncForEach(accounts, async account => {
                            console.log("Refreshing account " + account.accountId);
                            sendSNS(account, auth);
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

async function sendSNS(account, token) {
    let messageData = {
        Message: JSON.stringify({
            accountId: account.accountId,
            productCategory: account.productCategory,
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

function getSyncRefreshTimestamp() {
    const syncSpace = process.env.SYNC_REFRESH_DURATION.indexOf(' ');
    const numberOfUnit = new Number(process.env.SYNC_REFRESH_DURATION.substring(0, syncSpace));
    const timeUnit = process.env.SYNC_REFRESH_DURATION.substring(syncSpace + 1);
    return moment().subtract(numberOfUnit, timeUnit).valueOf();
}