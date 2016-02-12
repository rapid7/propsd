'use strict';

const HTTP_OK = 200;
const HTTP_METHOD_NOT_ALLOWED = 405;

/**
 * Conqueso compatible API
 *
 * @param {Express.App} app
 */
function Conqueso(app) {
  function methodNotAllowed(req, res) {
    res.set('Allow', 'POST,PUT,OPTIONS');
    res.status(HTTP_METHOD_NOT_ALLOWED);
    res.end();
  }

  const route = app.route('/v1/conqueso*');

  route.get((req, res) => {
    res.set('Content-Type', 'text/plain')
    res.status(HTTP_OK);
    res.end();
  });

  route.post((req, res) => {
    res.status(HTTP_OK).end();
  });

  route.put((req, res) => {
    res.status(HTTP_OK).end();
  });

  route.options((req, res) => {
    res.set('Allow', 'POST,PUT,OPTIONS');
    res.status(HTTP_OK);
    res.end();
  });

  route.head(methodNotAllowed);
  route.all(methodNotAllowed);
}

exports.attach = Conqueso;
