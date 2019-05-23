const jwt = require('jsonwebtoken');

// Set in `environment` of serverless.yml
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_CLIENT_PUBLIC_KEY = process.env.AUTH0_CLIENT_PUBLIC_KEY;

// Policy helper function
const generatePolicy = (principalId, effect, resource) => {
  const authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    const policyDocument = {};
    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];
    const statementOne = {};
    statementOne.Action = 'execute-api:Invoke';
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};

// Reusable Authorizer function, set on `authorizer` field in serverless.yml
module.exports.auth = async (event) => {
  if (!event.authorizationToken) {
    console.log("No authorization token");
    return "Unauthorized";
  }

  const tokenParts = event.authorizationToken.split(' ');
  const tokenValue = tokenParts[1];

  if (!(tokenParts[0].toLowerCase() === 'bearer' && tokenValue)) {
    // no auth token!
    console.log("No Bearer token");
    return "Unauthorized";
  }
  const options = {
    audience: AUTH0_CLIENT_ID,
  };

  try {
    var decoded = await jwt.verify(tokenValue, AUTH0_CLIENT_PUBLIC_KEY, options);

    //arn is used for caching of the validation
    //as mentioned here: https://medium.com/asked-io/serverless-custom-authorizer-issues-on-aws-57a40176f63f
    const arn = event.methodArn.split('/').slice(0, 2).join('/') + '/*';
    return await generatePolicy(decoded.sub, 'Allow', arn);
  } catch (error) {
    console.log(error);
    return "Unauthorized";
  }
};

// Public API
module.exports.publicEndpoint = async (event) => {
  return {
    statusCode: 200,
    headers: {
      /* Required for CORS support to work */
      'Access-Control-Allow-Origin': '*',
      /* Required for cookies, authorization headers with HTTPS */
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      message: 'Hi ⊂◉‿◉つ from Public API',
    })
  };
};

// Private API
module.exports.privateEndpoint = async (event) => {
  return {
    statusCode: 200,
    headers: {
      /* Required for CORS support to work */
      'Access-Control-Allow-Origin': '*',
      /* Required for cookies, authorization headers with HTTPS */
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      message: 'Hi ⊂◉‿◉つ from Private API. Only logged in users can see this',
    }),
  };
}