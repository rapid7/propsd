'use strict';

const flatten = require('flat');

const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;

/**
 * Format the given data as Java properties
 *
 * @param {Object} data
 * @return {String}
 */
function makeJavaProperties(data) {
  const results = [];

  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      results.push(key + '=' + data[key]);
    }
  }

  return results.join('\n');
}

/**
 * Converts Consul addresess to Conqueso addresses
 *
 * Addresses returned by the Consul plugin are formatted as
 * {
 *   "consul.service.addresses": ["x.x.x.x", "y.y.y.y"]
 * }
 *
 * Addresses returned by Conqueso are formatted as
 * {
 *   "conqueso.service.ips": "x.x.x.x, y.y.y.y"
 * }
 *
 * @param {Object} properties  Properties as returned from Storage#properties
 * @return {Object}            Properties with Consul address converted to Conqueso ones
 */
function injectConquesoAddresses(properties) {
  const conquesoIps = Object.create(null);

  if (properties.consul) {
    Object.keys(properties.consul).forEach((service) => {
      const cluster = properties.consul[service].cluster;

      conquesoIps[`conqueso.${cluster}.ips`] = properties.consul[service].addresses.join(',');
    });
  }

  return Object.assign(properties, conquesoIps);
}

/**
 * Format the given properties as Conqueso properties
 *
 * @param {Object} properties  Properties as returned from Storage#properties
 * @return {String}            Flattened Java properties as returned by Conqueso
 */
function makeConquesoProperties(properties) {
  let results = injectConquesoAddresses(properties);

  results = flatten(results);

  return makeJavaProperties(results);
}

/**
 * Conqueso compatible API
 *
 * @param {Express.App} app
 * @param {Storage} storage
 */
function Conqueso(app, storage) {
  const route = app.route('/v1/conqueso*');
  const allowedMethods = 'GET,POST,PUT,OPTIONS';

  function methodNotAllowed(req, res) {
    res.set('Allow', allowedMethods);
    res.status(HTTP_METHOD_NOT_ALLOWED);
    res.end();
  }

  route.get((req, res) => {
    res.set('Content-Type', 'text/plain');
    res.status(HTTP_OK);
    res.end(makeConquesoProperties(storage.properties));
  });

  // Express defaults to using the GET route for HEAD requests.
  // So we need to explicitly reject HEAD request.
  route.head(methodNotAllowed);

  route.post((req, res) => {
    res.status(HTTP_OK);
    res.end();
  });

  route.put((req, res) => {
    res.status(HTTP_OK);
    res.end();
  });

  route.options((req, res) => {
    res.set('Allow', allowedMethods);
    res.status(HTTP_OK);
    res.end();
  });

  // Reject anything else e.g. DELETE, TRACE, etc.
  route.all(methodNotAllowed);
}

exports.attach = Conqueso;
