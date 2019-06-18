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
    const nvalue = value.replace(/\s/g, '');
    console.log("Searching on Mastercard for merchant " + nvalue + "...");
    try {
        const requestData = {
            "merchant_id": nvalue,
            "type": "FuzzyMatch"
        };

        return merchantIdentifier.MerchantIds.query(requestData, function (error, data) {
            if (error) {
                console.log("HttpStatus: " + error.getHttpStatus());
                console.log("Message: " + error.getMessage());
                console.log("ReasonCode: " + error.getReasonCode());
                console.log("Source: " + error.getSource());
                console.log(error);

            }
            else {
                if (data && data.returnedMerchants && data.returnedMerchants.length > 0) {
                    console.log("MCC Code found for " + nvalue + " is: " + data.returnedMerchants[0].merchantCategory);
                    return data.returnedMerchants[0].merchantCategory;
                }
                return undefined;
            }
        });
    } catch (error) {
        console.log(error);
    }
    console.log("Search for " + nvalue + " in Mastercard complete.");
};

module.exports = {
    search
};