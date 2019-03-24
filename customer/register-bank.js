const AWS = require("aws-sdk"); // must be npm installed to use
const jsonResponse = require("../libs/json-response");
const r2 = require("r2");

const url = "http://localhost:4000/accounts";

var snsOpts = {
    region: "ap-southeast-2"
};

isOffline = () => process.env.IS_OFFLINE;

if (isOffline()) {
    snsOpts.endpoint = "http://127.0.0.1:4002";
}

let sns = new AWS.SNS(snsOpts);

//este endpoint va ser invocado despues de recibir el access_token
//consultar las accounts y por cada una, send an sns con los datos de la misma
//multiple listener recibiran la account y haran algo como consultar balances, account details y transactions 
module.exports.handler = async (event, context) => {
    const data = JSON.parse(event.body);

    try {
        let response = await r2(url).json;

        if (response && response.data && response.data.accounts) {
            response.data.accounts.forEach(account => {
                account.customerId = event.requestContext.authorizer.principalId;
                let messageData = {
                    Message: JSON.stringify(account),
                    TopicArn: process.env.accountsTopicArn,
                };

                console.log("PUBLISHING MESSAGE TO SNS:", messageData);
                try {
                    sns.publish(messageData).promise();
                }
                catch (err) {
                    console.log(err);
                }
            });
        }
        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};