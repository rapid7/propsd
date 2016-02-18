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

  it('maintains an ordered list of active sources', () => {
    const storage = new Storage();
    const source1 = {properties: {food: ['tacos', 'peanuts']}};
    const source2 = {properties: {food: null}};

    should(storage).have.property('sources');
    should(storage.sources).be.empty();

    storage.register(source1);
    should(storage.sources).eql([source1]);

    storage.register(source2);
    should(storage.sources).eql([source1, source2]);
  });

  it('ignores null when merging properites', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);

    storage.register({
      properties: {
        food: ['tacos', 'peanuts']
      }
    });

    storage.register({
      properties: {
        food: null
      }
    });

    emitter.on('update', (properties) => {
      should(properties).have.property('food');
      should(properties.food).eql(['tacos', 'peanuts']);
      done();
    });

    storage.update();
  });

  it('ignores undefined when merging properites', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);

    storage.register({
      properties: {
        food: ['tacos', 'peanuts']
      }
    });

    storage.register({
      properties: {
        food: undefined
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
      properties: {
        food: ['tacos', 'peanuts']
      }
    });

    storage.register({
      properties: {
        food: () => {
          return 'cabbage';
        }
      }
    });

    emitter.on('update', (properties) => {
      should(properties).have.property('food');
      should(properties.food).eql(['tacos', 'peanuts']);
      done();
    });

    storage.update();
  });

  it('overwrites arrays when merging properites', (done) => {
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
      should(properties.food).eql(['noodles']);
      done();
    });

    storage.update();
  });

  it('overwrite JSON types when merging properties', (done) => {
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

  it('recursive merge when merging properties', (done) => {
    const emitter = new EventEmitter();
    const storage = new Storage(emitter);

    storage.register({
      properties: {
        food: {
          likes: 'pizza'
        }
      }
    });

    storage.register({
      properties: {
        food: {
          likes: 'tacos',
          dislikes: 'gluten'
        }
      }
    });

    emitter.on('update', (properties) => {
      should(properties).have.property('food');
      should(properties.food).eql({likes: 'tacos', dislikes: 'gluten'});
      done();
    });

    storage.update();
  });
});
