'use strict';

const VERSION = require('../../../package').version;
const STATUS_CODES = require('../../util/status-codes');

const started = Date.now();

/**
 * Core API
 *
 * @param {Express.app} app
 * @param {Sources} sources
 */
function Core(app, sources) {
  const routes = {
    health: app.route('/v1/health'),
    status: app.route('/v1/status')
  };
  const allowedMethods = 'GET';

  /**
   * Sets headers and status for routes that should return a 405
   * @param {Express.req} req
   * @param {Express.res} res
   */
  const methodNotAllowed = (req, res) => {
    res.set('Allow', allowedMethods);
    res.status(STATUS_CODES.METHOD_NOT_ALLOWED);
    res.end();
  };

  routes.health.get((req, res) => {
    const health = sources.health();
    const plugins = {};

    health.sources.forEach((source) => {
      if (Object.keys(plugins).indexOf(source.type) < 0) {
        plugins[source.type] = 1;
      } else {
        plugins[source.type] += 1;
      }
    });

    res.status(health.code);
    res.json({
      status: health.code,
      uptime: Date.now() - started,
      plugins,
      version: VERSION
    });
  });

  routes.status.get((req, res) => {
    const health = sources.health();

    res.status(health.code);
    res.json({
      status: health.status,
      uptime: Date.now() - started,
      version: VERSION,

      indices: health.indices,
      sources: health.sources
    });
  });

  // All other METHODs should return a 405 with an 'Allow' header
  for (const r in routes) {
    if (routes.hasOwnProperty(r)) {
      routes[r].all(methodNotAllowed);
    }
  }
}

exports.attach = Core;
