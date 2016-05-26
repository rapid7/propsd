'use strict';

const flatten = require('flat');
const clone = require('clone');

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

  results = translateConquesoAddresses(results);
  results = flatten(results);

  return results;
}

/**
 * Conqueso compatible API
 *
 * @param {Express.App} app
 * @param {Storage} storage
 */
function Conqueso(app, storage) {
  // Conqueso compatible APIs are defined before the generic catch all route.
  app.get('/v1/conqueso/api/roles/:role/properties/:property', (req, res) => {
    const property = req.params.property;
    const properties = makeConquesoProperties(storage.properties);

    res.set('Content-Type', 'text/plain');
    res.status(HTTP_OK);

    if (property && (properties.hasOwnProperty(property))) {
      res.end(String(properties[property]));
    } else {
      res.end();
    }
  });

  // Handle any other requests by returning all properites.
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
    res.end(makeJavaProperties(makeConquesoProperties(storage.properties)));
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
