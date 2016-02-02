const Storage = require('../../storage');

const started = Date.now();

/**
 * Core API, v1
 *
 * @param  {Express.App} app
 */
exports.attach = function (app) {
  app.get('/v1/health', function (req, res, next) {
    res.json({
      ok: true,
      uptime: Date.now() - started
    });
  });

  app.get('/v1/status', function (req, res, next) {
    res.json({
      ok: true,
      uptime: Date.now() - started,
      index: Storage.index.status(),
      sources: Storage.sources.map(function (source) {
        return {
          name: source.name,
          type: source.type,
          status: source.status()
        };
      })
    });
  });

  app.get('/v1/properties', function (req, res, next) {
    res.json(Storage.properties);
  });

  app.get('/v1/properties/:source', function (req, res, next) {
    const source = Storage.source(req.params.source);

    if (!source) return res.status(404).json({ // eslint-disable-line rapid7/static-magic-numbers
      ok: false,
      error: 'Source ' + req.params.source + ' is not defined'
    });

    res.json(source.parser.properties);
  });

  app.get('/v1/config', function (req, res, next) {
    res.json(Config.get());
  });
};
