'use strict';

const axios = require("axios");
const banksDAO = require("./banks.js");
const encodeHelper = require("../libs/encode-helper");
const dynamoDbHelper = require('../libs/dynamodb-helper');
const dynamoDb = dynamoDbHelper.dynamoDb;
var qs = require('querystring');

async function registerUserBankAuth(data, principalId) {
    const timestamp = new Date().getTime();

    try {
        const bank = await banksDAO.getBankByCode(data.bank_code);
        if (bank) {
            const token_request = {
                code: data.auth_code,
                client_id: bank.oidc_config.client_id,
                client_secret: bank.oidc_config.client_secret,
                redirect_uri: bank.oidc_config.redirect_uri,
                grant_type: "authorization_code"
            };

            let token_response = await axios.post(bank.oidc_config.metadata.token_endpoint,
                qs.stringify(token_request),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

            if (token_response && token_response.data) {
                //TODO: call https://dev-mybank.au.auth0.com/api/v2/users/auth0|5ca30dd504099c0e4aec4471 
                //to retrieve last_login and last_ip

                console.log("Token successfully exchanged with bank " + bank.code);
                const userBankAuth = {
                    customerId: principalId,
                    last_updated: timestamp,
                    last_refreshed: timestamp,
                    bank: bank.code,
                    access_token: token_response.data.access_token,
                    id_token: token_response.data.id_token,
                    expires_in: token_response.data.expires_in,
                    token_type: token_response.data.token_type,
                    cdr_url: bank.cdr_url,
                    consent_duration: data.consent_duration,
                    consent_scopes: data.consent_scopes
                };

                await dynamoDb.put({
                    TableName: process.env.USER_BANK_AUTH_TABLE,
                    Item: userBankAuth
                }).promise();

                console.log("User bank authentication: " + principalId + " created successfully");
                return userBankAuth;
            }
        }
    } catch (error) {
        //TODO: improve error handling
        console.error(error);
    }
}

async function getUserBankAuth(bankcode, principalId) {
    const params = {
        TableName: process.env.USER_BANK_AUTH_TABLE,
        Key: {
            customerId: principalId,
            bank: bankcode
        }
    };

    try {
        let data = await dynamoDb.get(params).promise();
        //TODO: check the token is not expired
        return data.Item;
    } catch (error) {
        console.log(error);
        return undefined;
    }
};


/**
 * Get all UserBankAuth that haven't been refreshed before time. 
 * The function paginates the result using pagesize and nextkey.
 * 
 * @param {time} time 
 * @param {page} page 
 */
async function getUserBankAuths(timestamp, pagesize, nextkey) {
    const params = {
        TableName: process.env.USER_BANK_AUTH_TABLE,
        Limit: pagesize,
        ScanIndexForward: false,
        FilterExpression: 'last_refreshed <= :timestamp',
        ExpressionAttributeValues: {
            ':timestamp': timestamp
        }
    };

    if (nextkey && nextkey.length > 0) {
        params.ExclusiveStartKey = encodeHelper.decodeKeyAsJson(nextkey);
    }

    try {
        return await dynamoDb.scan(params).promise();
    } catch (error) {
        console.log(error);
        return undefined;
    }
};

async function updateRefreshTime(userBankAuth) {
    userBankAuth.last_refreshed = new Date().getTime();

    await dynamoDb.put({
        TableName: process.env.USER_BANK_AUTH_TABLE,
        Item: userBankAuth
    }).promise();
};

module.exports = {
    getUserBankAuth,
    registerUserBankAuth,
    getUserBankAuths,
    updateRefreshTime
};