const AWS = require("aws-sdk");
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

//this endpoint refreshes account's details
module.exports.handler = async (event, context) => {
    const accountId = event.pathParameters.accountId;
    const principalId = event.requestContext.authorizer.principalId;

    try {
        let response = await r2(url).json;
        if (response && response.data && response.data.accounts) {

            const result = response.data.accounts.find(account => account.accountId === accountId);
            if (result) {
                result.customerId = principalId;
                let messageData = {
                    Message: JSON.stringify(result),
                    TopicArn: process.env.accountsTopicArn,
                };

                console.log("PUBLISHING MESSAGE TO SNS:", messageData);
                try {
                    sns.publish(messageData).promise();
                }
                catch (err) {
                    console.log(err);
                }
            }else{
                console.log("Account not found.");
            }
        }else{
            console.log("No account data.");
        }
        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};