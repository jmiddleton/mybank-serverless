"use strict";

const merchantIdentifier = require("mastercard-merchant-identifier");
const MasterCardAPI = merchantIdentifier.MasterCardAPI;

const consumerKey = process.env.MASTERCARD_CONSUMER_KEY;   // You should copy this from "My Keys" on your project page e.g. UTfbhDCSeNYvJpLL5l028sWL9it739PYh6LU5lZja15xcRpY!fd209e6c579dc9d7be52da93d35ae6b6c167c174690b72fa
const keyStorePath = process.env.MASTERCARD_P12; // e.g. /Users/yourname/project/sandbox.p12 | C:\Users\yourname\project\sandbox.p12
const keyAlias = process.env.MARTERCARD_KEY_ALIAS;   // For production: change this to the key alias you chose when you created your production key
const keyPassword = process.env.MARTERCARD_KEY_PASS;   // For production: change this to the key alias you chose when you created your production key

// You only need to do initialize MasterCardAPI once
const authentication = new MasterCardAPI.OAuth(consumerKey, keyStorePath, keyAlias, keyPassword);
MasterCardAPI.init({
    sandbox: true,
    debug: true,
    authentication: authentication
});


async function search(value, location) {
    console.log("Searching on Mastercard for merchant " + value + "...");
    try {
        const requestData = {
            "MerchantId": value,
            "Type": "FuzzyMatch"
        };

        merchantIdentifier.MerchantIdentifier.query(requestData, function (error, data) {
            if (error) {
                err("HttpStatus: " + error.getHttpStatus());
                err("Message: " + error.getMessage());
                err("ReasonCode: " + error.getReasonCode());
                err("Source: " + error.getSource());
                err(error);

            }
            else {
                console.log("MCC Code found for " + value + " is: " + data.MerchantIds.ReturnedMerchants.Merchant[0].MerchantCategory);
                return data.MerchantIds.ReturnedMerchants.Merchant[0].MerchantCategory;
            }
            console.log("Search in Mastercard complete.");
        });

    } catch (error) {
        console.log(error);
    }
};

module.exports = {
    search
};