'use strict';

const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_SERVER_ERROR = 500;

const STATUS = {
  okay: 'okay',
  warn: 'warn',
  fail: 'fail'
};

const started = Date.now();

class CoreUtils {
  /**
   * Generate a list of all installed plugins
   * @param {Storage} storage
   * @return {Array}
   */
  static getPlugins(storage) { // eslint-disable-line no-unused-vars
    // This is hardcoded until we have a Storage implementation with an interface
    // to list all plugins
    return ['s3', 'consul'];
  }

  /**
   * Get the aggregate status of all plugins
   * @param {Array} plugins
   * @return {Number}
   */
  static getPluginsStatus(plugins) {
    const statuses = plugins.map((plugin) => { // eslint-disable-line no-unused-vars
      // This is hardcoded until we have a Plugin implementation with an interface
      // to get a plugin's status
      return STATUS.okay;
    });
    const uniqueStatuses = Array.from(new Set(statuses));

    if (uniqueStatuses.indexOf(STATUS.fail) !== -1) {
      return HTTP_INTERNAL_SERVER_ERROR;
    } else if (uniqueStatuses.indexOf(STATUS.warn) !== -1) {
      return HTTP_TOO_MANY_REQUESTS;
    }
    return HTTP_OK;
  }
}

/**
 * Core API
 *
 * @param {Express.app} app
 * @param {Storage} storage
 */
function Core(app, storage) {
  const routes = {
    health: app.route('/v1/health'),
    status: app.route('/v1/status')
  };
  const allowedMethods = 'GET';

  const plugins = CoreUtils.getPlugins(storage);
  const status = CoreUtils.getPluginsStatus(plugins);

  /**
   * Sets headers and status for routes that should return a 405
   * @param {Express.req} req
   * @param {Express.res} res
   */
  const methodNotAllowed = (req, res) => {
    res.set('Allow', allowedMethods);
    res.status(HTTP_METHOD_NOT_ALLOWED);
    res.end();
  };

  routes.health.get((req, res) => {
    res.status(status);

    res.json({
      status,
      uptime: Date.now() - started,
      plugins
    });
  });

  routes.status.get((req, res) => {
    res.status(status);

    res.json({
      status,
      uptime: Date.now() - started,
      index: storage.index.status(),
      sources: storage.sources.map((source) => {
        return {
          name: source.name,
          type: source.type,
          status: source.status(),
          mtime: source.mtime
        };
      })
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
