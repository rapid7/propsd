/* eslint-env mocha */
'use strict';

const should = require('should');
const Storage = require('../lib/storage');

describe('Storage Engine', () => {
  it('has no properties by default', () => {
    const storage = new Storage();

    storage.should.have.property('properties');
    should(storage.properties).be.empty();
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

  it('ignores sources without properties', () => {
    const storage = new Storage();

    storage.register(null);
    storage.register(undefined);
    storage.register(1.0);
    storage.register('properties');
    storage.register(() => {});
    storage.register([]);
    storage.register({});

    should(storage.sources).eql([]);
  });

  it('merges properties on demand', () => {
    const storage = new Storage();

    storage.register({
      properties: {
        food: 'tacos'
      }
    });

    should(storage.properties).not.have.property('food');
    storage.update();
    should(storage.properties).have.property('food');
  });

  it('ignores null when merging properties', () => {
    const storage = new Storage();

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

    storage.update();
    should(storage.properties).have.property('food');
    should(storage.properties.food).eql(['tacos', 'peanuts']);
  });

  it('ignores undefined when merging properties', () => {
    const storage = new Storage();

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

    storage.update();
    should(storage.properties).have.property('food');
    should(storage.properties.food).eql(['tacos', 'peanuts']);
  });

  it('ignores Functions when merging properties', () => {
    const storage = new Storage();

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

    storage.update();
    should(storage.properties).have.property('food');
    should(storage.properties.food).eql(['tacos', 'peanuts']);
  });

  it('overwrites arrays when merging properties', () => {
    const storage = new Storage();

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

    storage.update();
    should(storage.properties).have.property('food');
    should(storage.properties.food).eql(['noodles']);
  });

  it('overwrite JSON types when merging properties', () => {
    const storage = new Storage();

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

    storage.update();
    should(storage.properties).have.property('food');
    should(storage.properties.food).eql('pizza');
  });

  it('recursive merge when merging properties', () => {
    const storage = new Storage();

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

    storage.update();
    should(storage.properties).have.property('food');
    should(storage.properties.food).eql({likes: 'tacos', dislikes: 'gluten'});
  });
});
