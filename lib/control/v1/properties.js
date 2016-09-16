'use strict';

/**
 * JSON output API
 *
 * @param {Express.App} app
 * @param {Properties} storage
 */
exports.attach = function attach(app, storage) {
  app.get('/v1/properties', function handler(req, res) {
    res.json(storage.properties);
  });
};
