'use strict';

const HTTP = require('http');

const STATUS_CODES =
module.exports = Object.assign({}, HTTP.STATUS_CODES);

const M_REJECT_CHARS = /\W/g;
const M_DELIMITERS = /\s/g;

// Reverse-map status names to codes
Object.keys(STATUS_CODES).forEach(function _(code) {
  const message = STATUS_CODES[code];

  let name = message.replace(M_DELIMITERS, '_');

  name = name.replace(M_REJECT_CHARS, '');
  name = name.toUpperCase();

  STATUS_CODES[name] = Number(code);
});
