const Winston = require('winston');

function Logger(config) {
  return new Winston.Logger({
    level: config.get('log:level'),
    transports: [
      new Winston.transports.Console({
        colorize: true,
        timestamp: true
      }),
      new Winston.transports.File({
        filename: config.get('log:filename')
      })
    ]
  });
}

exports.attach = Logger;
