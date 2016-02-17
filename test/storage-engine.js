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

    const updateTimeoutMS = 1000;
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

  it('prevents update event spam', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);
    const updateTimeoutMS = 1000;

    let updateEventCount = 0;

    emitter.on('update', (properties) => {
      updateEventCount += 1;
      should(properties).be.empty();
    });

    storage.update();
    storage.update();

    setTimeout(() => {
      assert.equal(updateEventCount, 1, 'Too many Storage#update events sent');
      done();
    }, updateTimeoutMS);
  });

  it('ignores null when merging properites', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);

    storage.register({
      properties: null
    });

    storage.register({
      properties: {
        food: ['tacos', 'peanuts']
      }
    });

    emitter.on('update', (properties) => {
      should(properties).have.property('food');
      should(properties.food).eql(['tacos', 'peanuts']);
      done();
    });

    storage.update();
  });

  it('ignores Functions when merging properites', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);

    storage.register({
      properties: () => {
        return {
          food: 'cabbage'
        };
      }
    });

    storage.register({
      properties: {
        food: ['tacos', 'peanuts']
      }
    });

    emitter.on('update', (properties) => {
      should(properties).have.property('food');
      should(properties.food).eql(['tacos', 'peanuts']);
      done();
    });

    storage.update();
  });

  it('concatenates arrays when merging properites', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);

    storage.register({
      properties: {
        food: ['tacos', 'peanuts']
      }
    });

    storage.register({
      properties: {
        food: ['noodles']
      }
    });

    emitter.on('update', (properties) => {
      should(properties).have.property('food');
      should(properties.food).eql(['tacos', 'peanuts', 'noodles']);
      done();
    });

    storage.update();
  });

  it('lets the last plugin win when merging properties', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);

    storage.register({
      properties: {
        food: ['tacos', 'peanuts']
      }
    });

    storage.register({
      properties: {
        food: 'pizza'
      }
    });

    emitter.on('update', (properties) => {
      should(properties).have.property('food');
      should(properties.food).eql('pizza');
      done();
    });

    storage.update();
  });
});
