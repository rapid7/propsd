'use strict';

const HTTP_OK = 200;

/**
 * Conqueso compatible API
 *
 * @param {Express.App} app
 */
function Conqueso(app) {
  app.post('/v1/conqueso*', (req, res) => {
    res.status(HTTP_OK).end();
  });
}

exports.attach = Conqueso;
