'use strict';

const flatten = require('flat');

const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;

/**
 * Deep copy an object
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
 *
 * @param {Object} object  The object to be copied
 * @return {Object}        A deep copy of the provided object
 */
function clone(object) {
  if (!(object instanceof Object)) {
    return object;
  }

  const Constructor = object.constructor;
  let clonedObject = null;

  switch (Constructor) {
    case RegExp:
      clonedObject = new Constructor(object);
      break;
    case Date:
      clonedObject = new Constructor(object.getTime());
      break;
    default:
      clonedObject = new Constructor();
  }

  for (const key in object) { // eslint-disable-line guard-for-in
    clonedObject[key] = clone(object[key]);
  }

  return clonedObject;
}

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
    const prop = req.params['0'].replace(new RegExp('/', 'g'), '');
    let val;

    res.set('Content-Type', 'text/plain');
    res.status(HTTP_OK);

    if (prop && (prop in storage.properties)) {
      val = String(storage.properties[prop]);
    } else {
      val = makeConquesoProperties(storage.properties);
    }

    res.end(val);
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
