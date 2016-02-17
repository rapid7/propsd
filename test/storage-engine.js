/* eslint-env mocha */
'use strict';

const should = require('should');

const Storage = require('../lib/storage');

describe('Storage Engine', () => {
  it('has no properties by default', () => {
    const storage = new Storage();

    storage.should.have.property('properties');
    should(storage.properties).be.empty;
  });
});
