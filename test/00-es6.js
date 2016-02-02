/**
 * Does Node.JS 4 parse ES6 syntax?
 */
/* jshint esnext: true, -W097, -W117 */
'use strict';

var expect = require('chai').expect;
var EventEmitter = require('events').EventEmitter;

class Squawk extends EventEmitter {
  constructor() {
    super();

    this.foo = 'bar';
  }

  tweet(noise) {
    this.emit('tweet', noise);
  }

  static make() {
    return new this();
  }

  static getter() {
    return this.baz;
  }

  get muh() {
    return 'shrug';
  }

}

Squawk.Test = class Test {};

Squawk.baz = 'quxx';

describe('ES6 Support', function() {
  var squawk = new Squawk();

  it('Inherits a parent class correctly', function() {
    expect(squawk).to.be.an.instanceof(EventEmitter);
    expect(squawk).to.have.property('domain');
  });

  it('Sets and exposes static/class properties correctly', function() {
    expect(Squawk).to.have.property('baz');
    expect(Squawk.baz).to.equal('quxx');
  });

  it('Sets and exposes instance properties correctly', function() {
    expect(squawk).to.have.property('foo');
    expect(squawk.foo).to.equal('bar');
  });

  it('Implements static methods correctly', function() {
    expect(Squawk.make()).to.be.an.instanceof(Squawk);
    expect(Squawk.getter()).to.equal('quxx');
  });

  it('Inherits a parent class\' methods correctly', function(done) {
    squawk.once('tweet', function(noise) {
      expect(noise).to.equal('HOOT');
      done();
    });

    squawk.emit('tweet', 'HOOT');
  });

  it('Implements instance methods correctly', function(done) {
    squawk.once('tweet', function(noise) {
      expect(noise).to.equal('HOOT');
      done();
    });

    squawk.tweet('HOOT');
  });

  it('Implements instance getters and setters correctly', function() {
    expect(squawk.muh).to.equal('shrug');
  });
});
