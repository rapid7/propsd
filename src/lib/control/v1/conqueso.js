'use strict';

const flatten = require('flat');
const clone = require('clone');

const STATUS_CODES = require('../../util/status-codes');

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
 * Warning! Original Consul properties are removed
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
function translateConquesoAddresses(properties) {
  if (properties.consul) {
    Object.keys(properties.consul).forEach((service) => {
      const cluster = properties.consul[service].cluster;

  /* eslint-disable no-param-reassign */
      properties[`conqueso.${cluster}.ips`] = properties.consul[service].addresses.join(',');
    });
    delete properties.consul;
  }

  /* eslint-enable no-param-reassign */
  return properties;
}

/**
 * Format the given properties as Conqueso properties
 *
 * @param {Object} properties  Properties as returned from Storage#properties
 * @return {String}            Flattened Java properties as returned by Conqueso
 */
function makeConquesoProperties(properties) {
  let results = clone(properties);

  // Remove properties that came from the EC2 metadata API.
  delete results.instance;
  delete results.tags;

  results = translateConquesoAddresses(results);
  results = flatten(results);

  return results;
}

/**
 * Conqueso compatible API
 *
 * @param {Express.App} app
 * @param {Properties} storage
 */
function Conqueso(app, storage) {
  // Conqueso compatible APIs are defined before the generic catch all route.
  app.get('/v1/conqueso/api/roles/:role/properties/:property', (req, res) => {
    const property = req.params.property;

    storage.properties.then((props) => {
      const properties = makeConquesoProperties(props);

      res.set('Content-Type', 'text/plain');

      if (property && (properties.hasOwnProperty(property))) {
        res.end(String(properties[property]));
      } else {
        res.end();
      }
    });
  });

  // Handle any other requests by returning all properites.
  const route = app.route('/v1/conqueso*');
  const allowedMethods = 'GET,POST,PUT,OPTIONS';

  /**
   * Sends 405 response with 'Allow' header to any disallowed HTTP methods
   * @param {app.request} req
   * @param {app.response} res
   */
  function methodNotAllowed(req, res) {
    res.set('Allow', allowedMethods);
    res.status(STATUS_CODES.METHOD_NOT_ALLOWED);
    res.end();
  }

  route.get((req, res) => {
    storage.properties.then((props) => {
      res.set('Content-Type', 'text/plain');
      res.end(makeJavaProperties(makeConquesoProperties(props)));
    });
  });

  // Express defaults to using the GET route for HEAD requests.
  // So we need to explicitly reject HEAD request.
  route.head(methodNotAllowed);

  route.post((req, res) => {
    res.end();
  });

  route.put((req, res) => {
    res.end();
  });

  route.options((req, res) => {
    res.set('Allow', allowedMethods);
    res.end();
  });

  // Reject anything else e.g. DELETE, TRACE, etc.
  route.all(methodNotAllowed);
}

exports.attach = Conqueso;
