const AWS = require("aws-sdk");
const jsonResponse = require("../libs/json-response");

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

    try {
        let account = await getAccountById(accountId, principalId);
        if (account) {
            let bank = await getBank(account.institution);
            if (bank) {
                //TODO: get userbankauth
                let token = {
                    access_token: "zcvadfadf",
                    id_token: "Dfadf",
                    expires_in: 1353604926,
                    token_type: "Bearer",
                    refresh_token: "adfaf"
                };
                sendSNS(event, account, bank, token);
            }
        }
        return jsonResponse.ok({});
    } catch (err) {
        console.log(err);
        return jsonResponse.error();
    }
};

async function sendSNS(event, account, bank, token) {
    let messageData = {
        Message: JSON.stringify({
            accountId: account.accountId,
            customerId: event.requestContext.authorizer.principalId,
            cdr_url: bank.cdr_url,
            bank_code: bank.code,
            access_token: token.access_token
        }),
        TopicArn: process.env.accountsTopicArn,
    };

    console.log("PUBLISHING MESSAGE TO SNS:", messageData);
    try {
        sns.publish(messageData).promise();
    } catch (err) {
        console.log(err);
    }
}

async function getBank(code) {
    const params = {
        TableName: process.env.BANKS_TABLE,
        Key: {
            code: code
        }
    };

    try {
        let data = await dynamoDb.get(params).promise();
        return data.Item;
    } catch (error) {
        console.log(error);
        return undefined;
    }
};

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