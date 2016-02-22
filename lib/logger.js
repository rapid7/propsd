'use strict';

const Winston = require('winston');

function Logger(config) {
  const logger = new Winston.Logger({
    level: config.get('log:level'),
    transports: [
      new Winston.transports.Console({
        colorize: true,
        timestamp: true
      })
    ]
  });

  const filename = config.get('log:filename');

  if (filename) {
    logger.add(Winston.transports.File, {
      filename
    });
  }

  return logger;
}

exports.attach = Logger;
