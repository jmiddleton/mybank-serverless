const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");
const userbankHelper = require("./userbank-helper");

var dynamodbOfflineOptions = {
    region: "localhost",
    endpoint: "http://localhost:8000"
},
    isOffline = () => process.env.IS_OFFLINE;

const dynamoDb = isOffline()
    ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
    : new AWS.DynamoDB.DocumentClient();

var snsOpts = {
    region: "ap-southeast-2"
};

isOffline = () => process.env.IS_OFFLINE;

if (isOffline()) {
    snsOpts.endpoint = "http://127.0.0.1:4002";
}

let sns = new AWS.SNS(snsOpts);

//this endpoint refreshes account's details
module.exports.handler = async (event) => {
    const accountId = event.pathParameters.accountId;
    const principalId = event.requestContext.authorizer.principalId;
    const data = JSON.parse(event.body);

    try {
        let userBankAuth;
        if (data.auth_code) {
            userBankAuth = await userbankHelper.registerUserBankAuth(data.bank_code, data.auth_code, principalId);
        } else {
            userBankAuth = await userbankHelper.getUserBankAuth(data.bank_code, principalId);
        }

        if (userBankAuth) {
            sendSNS(accountId, userBankAuth);
        } else {
            return jsonResponse.forbidden({ error: "TokenNotFound", message: "Access token not found" });
        }

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

// Get account details endpoint
async function getAccountById(accountId, customerId) {
    const params = {
        TableName: process.env.ACCOUNTS_TABLE,
        ProjectionExpression: 'accountId, institution',
        Key: {
            customerId: customerId,
            accountId: accountId,
        }
    };

    try {
        let data = await dynamoDb.get(params).promise();
        return data.Item;
    } catch (error) {
        console.log(error);
        return undefined;
    }
}