'use strict';

const Winston = require('winston');
const morgan = require('morgan');

function Logger(level, filename) {
  const logLevel = level || 'info';

  const logger = new Winston.Logger({
    level: logLevel,
    transports: [
      new Winston.transports.Console({
        colorize: true,
        timestamp: true
      })
    ]
  });

  if (filename) {
    logger.add(Winston.transports.File, {filename});
  }

  return logger;
}

function logRequests(method) {
  const requestLogFormat = {
    remote_addr: ':remote-addr',
    remote_user: ':remote-user',
    date: ':date[clf]',
    method: ':method',
    url: ':url',
    http_version: ':http-version',
    status: ':status',
    result_length: ':res[content-length]',
    referrer: ':referrer',
    user_agent: ':user-agent',
    response_time: ':response-time'
  };

  return morgan(JSON.stringify(requestLogFormat), {stream: {write: method}});
}

exports.attach = Logger;
exports.logRequests = logRequests;
