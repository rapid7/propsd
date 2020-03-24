'use strict';

const deprecate = require('depd')('propsd');
const Winston = require('winston');
const expressWinston = require('express-winston');

/**
 * Create a logger instance
 * @param {string} level
 * @param {string} filename
 * @returns {Winston.Logger}
 * @constructor
 */
function Logger(level, filename) {
  const logLevel = level.toUpperCase() || 'INFO';
  const javaLogLevels = {
    levels: {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      VERBOSE: 3,
      DEBUG: 4,
      SILLY: 5
    },
    colors: {
      ERROR: 'red',
      WARN: 'yellow',
      INFO: 'green',
      DEBUG: 'blue'
    }
  };

  const logger = new Winston.Logger({
    level: logLevel,
    levels: javaLogLevels.levels,
    colors: javaLogLevels.colors,
    transports: [
      new Winston.transports.Console({
        timestamp: true,
        json: Config.get('log:json'),
        stringify: Config.get('log:json'),
        colorize: Config.get('colorize')
      })
    ]
  });

  if (filename) {
    logger.add(Winston.transports.File, {filename, level});
    deprecate('The file transport has been deprecated and will be removed in a later version');
  }

  return logger;
}

/**
 * Generates middleware for Express to log incoming requests
 * @param {Winston.Logger} logger
 * @param {string} level
 * @returns {expressWinston.logger}
 * @constructor
 */
function RequestLogger(logger, level) {
  const logLevel = level.toUpperCase() || 'INFO';

  return expressWinston.logger({
    winstonInstance: logger,
    expressFormat: false,
    msg: '{{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
    level: logLevel,
    baseMeta: {sourceName: 'request'}
  });
}

exports.attach = Logger;
exports.requests = RequestLogger;
