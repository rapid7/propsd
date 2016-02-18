/* eslint-env mocha */
'use strict';

require('should');
const configs = require('../lib/config');
const Path = require('path');

describe('Config', () => {
  const configFile = Path.resolve(__dirname, './data/config.json');

  it('creates an nconf object', () => {
    configs.load().should.have.properties(['version', 'env', 'file', 'loadFiles', 'Provider']);
  });
  it('loads default properties', () => {
    configs.load().get('consul:host').should.equal('127.0.0.1');
  });
  it('loads properties from path', () => {
    configs.load(configFile).get('power:level').should.equal(9001); // eslint-disable-line rapid7/static-magic-numbers
  });
});
