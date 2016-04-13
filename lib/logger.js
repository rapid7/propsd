'use strict';

const deprecate = require('depd')('propsd');
const Winston = require('winston');

function Logger(level, filename) {
  const logLevel = level || 'info';

  const logger = new Winston.Logger({
    level: logLevel,
    transports: [
      new Winston.transports.Console({
        colorize: true,
        timestamp: true,
        json: true
      })
    ]
  });

  if (filename) {
    logger.add(Winston.transports.File, {filename, level});
    deprecate('The file transport has been deprecated and will be removed in a later version');
  }

  return logger;
}

exports.attach = Logger;
