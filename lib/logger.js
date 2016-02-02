const Winston = require('winston');

const Log = global.Log = new Winston.Logger({
  level: Config.get('log:level'),
  transports: [
    new Winston.transports.Console({
      colorize: true,
      timestamp: true
    })
  ]
});
