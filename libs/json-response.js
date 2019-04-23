function ok(data) {
  return json(200, data);
}

function error(data) {
  return json(400, data);
}

function notFound(data) {
  return json(404, data);
}

function forbidden(data) {
  return json(403, data);
}

function invalid(data) {
  return json(405, data);
}

function serverError(data) {
  return json(500, data);
}

function json(statusCode, data, headers = {}) {
  return ({
    statusCode,
    headers: Object.assign({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    }, headers),
    body: JSON.stringify(data),
  });
}

module.exports = {
  ok,
  error,
  serverError,
  notFound,
  json,
  invalid,
  forbidden
};