'use strict';

const AWS = require("aws-sdk");
const axios = require("axios");
const banksDAO = require("./banks.js");
var qs = require('querystring');

var dynamodbOfflineOptions = {
    region: "localhost",
    endpoint: "http://localhost:8000"
},
    isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
    ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
    : new AWS.DynamoDB.DocumentClient();

async function registerUserBankAuth(bankcode, auth_code, principalId) {
    const timestamp = new Date().getTime();

    try {
        const bank = await banksDAO.getBankByCode(bankcode);
        if (bank) {
            const token_request = {
                code: auth_code,
                client_id: bank.oidc_config.client_id,
                client_secret: bank.oidc_config.client_secret,
                redirect_uri: bank.oidc_config.redirect_uri,
                grant_type: "authorization_code"
            };

            let token_response = await axios.post(bank.oidc_config.metadata.token_endpoint,
                qs.stringify(token_request),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

            if (token_response && token_response.data) {
                console.log("Token successfully exchanged with bank " + bank.code);
                const userBankAuth = {
                    customerId: principalId,
                    last_updated: timestamp,
                    bank: bank.code,
                    access_token: token_response.data.access_token,
                    id_token: token_response.data.id_token,
                    expires_in: token_response.data.expires_in,
                    token_type: token_response.data.token_type,
                    cdr_url: bank.cdr_url
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

module.exports = {
    getUserBankAuth,
    registerUserBankAuth
};