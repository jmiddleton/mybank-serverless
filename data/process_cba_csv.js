'use strict';

const csvFilePath = './cba_may.csv';
const csv = require('csvtojson');
const moment = require('moment');
const shortid = require('shortid');

const inputDateFormat = "DD/MM/YYYY";
const outputDateFormat = "YYYY-MM-DDTHH:mm:ss";

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
            txn.postingDateTime = moment(posted, inputDateFormat).format(outputDateFormat);
        }

        const ind = desc ? desc.indexOf('AUS') : -1;

        if (desc.indexOf('Transfer') == 0 || ind == -1) {

        } else {
            const description = desc.substring(0, ind).trim();
            txn.description = description;

            const valueDate = desc.substring(desc.indexOf('Value Date: '), desc.length).trim();
            const newDate = moment(valueDate, inputDateFormat).format(outputDateFormat);
            if (newDate !== "Invalid date") {
                txn.valueDateTime = newDate;
            }

            const reference = desc.substring(ind + 4, desc.indexOf('Value Date:')).trim();
            txn.reference = reference;
        }

        txn.merchantCategoryCode = txn.cba_category;
        if (ind >= 0) {
            txn.merchantName = txn.description.substring(0, txn.description.indexOf(' '));
        }

        console.log(JSON.stringify(txn) + ",");
    });
    console.log("{}]");
});
