/* eslint-env mocha */
'use strict';

const should = require('should');
const assert = require('assert');
const EventEmitter = require('events');
const Storage = require('../lib/storage');

describe('Storage Engine', () => {
  it('has no properties by default', () => {
    const storage = new Storage();

    storage.should.have.property('properties');
    should(storage.properties).be.empty();
  });

  it('fires update events with new properties', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);

    const updateTimeoutMS = 5000;
    const updateTimeout = setTimeout(() => {
      assert(false, 'Storage#update event never fired.');
      done();
    }, updateTimeoutMS);

    emitter.on('update', (properties) => {
      clearTimeout(updateTimeout);
      should(properties).be.empty();
      done();
    });

    storage.update();
  });
});
