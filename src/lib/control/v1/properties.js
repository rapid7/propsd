'use strict';

const getNestedProperty = require('../../util').getNestedProperty;
const STATUS_CODES = require('../../util/status-codes');

/**
 * JSON output API
 *
 * @param {Express.App} app
 * @param {Properties} storage
 */
exports.attach = function attach(app, storage) {
  app.get('/v1/properties/:property*', function handler(req, res, next) {
    const properties = storage.properties;
    const prop = req.params.property;

    Log.log('INFO', 'Params: ', req.params);

    if (!properties[prop]) {
      return next(new Error(`Property ${prop} not found`));
    }

    const value = properties[prop];
    const extra = req.params[0].split('/').filter(Boolean);

    res.json(getNestedProperty(value, Array.from(extra)));
  });

  app.get('/v1/properties*', function handler(req, res) {
    res.json(storage.properties);
  });

  app.use('/v1/properties/:property*', (err, req, res, next) => { // eslint-disable-line no-unused-vars
    Log.log('ERROR', err);
    res.status(STATUS_CODES.METHOD_NOT_ALLOWED).json({});
  });
};
