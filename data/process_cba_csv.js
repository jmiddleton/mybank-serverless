'use strict';

const csvFilePath = './cba_may_07.csv';
const csv = require('csvtojson');
const moment = require('moment');
const shortid = require('shortid');

csv().fromFile(csvFilePath).then((jsonArray) => {
    console.log("[");
    jsonArray.forEach(txn => {
        const posted = txn.postingDateTime;
        const desc = txn.description;

        txn.accountId = "a12345";
        txn.transactionId = shortid.generate();
        txn.isDetailAvailable = false;
        txn.type = "PAYMENT";
        txn.status = posted ? "POSTED" : "PENDING";
        txn.currency = "AUD";

        if (posted) {
            txn.postingDateTime = moment(posted, "DD/MM/YY").format("YYYY-MM-DDTHH:mm:ss");
        }

        if(desc.indexOf('Transfer') == 0 || desc.indexOf('AUS') == -1 ){

        }else{
            const description = desc.substring(0, desc.indexOf('AUS')).trim();
            txn.description = description;

            const valueDate = desc.substring(desc.indexOf('Value Date: '), desc.length).trim();
            const newDate = moment(valueDate, "DD/MM/YY").format("YYYY-MM-DDTHH:mm:ss");
            if (newDate !== "Invalid date") {
                txn.valueDateTime = newDate;
            }

            const reference = desc.substring(desc.indexOf('AUS ') + 4, desc.indexOf('Value Date:')).trim();
            txn.reference = reference;
        }

        txn.merchantCategoryCode = txn.cba_category;
        txn.merchantName = "";

        console.log(JSON.stringify(txn) + ",");
    });
    console.log("{}]");
});
