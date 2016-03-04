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
   * Get the aggregate status of all plugins
   * @param {Array} plugins
   * @return {Number}
   */
  static getPluginsStatus(plugins) {
    const statuses = plugins.map((plugin) => { // eslint-disable-line no-unused-vars
      const status = plugin.status();

      if (status.ok) {
        return STATUS.okay;
      }
      return STATUS.fail;
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
 * @param {PluginManager} pluginManager
 */
function Core(app, storage, pluginManager) {
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
    res.status(HTTP_METHOD_NOT_ALLOWED);
    res.end();
  };

  routes.health.get((req, res) => {
    const plugins = storage.sources;
    const status = CoreUtils.getPluginsStatus(plugins);
    const pluginCounts = {};

    plugins.forEach((v) => {
      if (Object.keys(pluginCounts).indexOf(v.type) === -1) {
        pluginCounts[v.type] = 1;
      } else {
        pluginCounts[v.type]++;
      }
    });

    res.status(status);

    res.json({
      status,
      uptime: Date.now() - started,
      plugins: pluginCounts
    });
  });

  routes.status.get((req, res) => {
    const plugins = storage.sources;
    const status = CoreUtils.getPluginsStatus(plugins);

    const pluginStatuses = plugins.map((plugin) => {
      const pluginStatus = plugin.status();

      return {
        name: plugin.name,
        type: plugin.type,
        status: (pluginStatus.ok) ? STATUS.okay : STATUS.fail,
        mtime: plugin.mtime
      };
    });

    res.status(status);

    res.json({
      status,
      uptime: Date.now() - started,
      index: pluginManager.index.status(),
      sources: pluginStatuses
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
