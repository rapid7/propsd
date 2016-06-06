'use strict';

exports.attach = function attach(app, storage) {
  app.get('/v1/properties', function handler(req, res, next) {
    res.json(storage.properties);
  });
};
