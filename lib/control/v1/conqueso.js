'use strict';

const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;

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

  /**
   * Format the given data as Java properites
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

  route.get((req, res) => {
    res.set('Content-Type', 'text/plain');
    res.status(HTTP_OK);
    res.end(makeJavaProperties(storage.properties));
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
