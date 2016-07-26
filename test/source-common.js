'use strict';

/* eslint-env mocha */
/* global Config, Log */
/* eslint-disable rapid7/static-magic-numbers, max-nested-callbacks */

require('./lib/helpers');

const Source = require('./lib/stub/source');
const expect = require('chai').expect;

describe('Source/Common', function _() {
  it('sets configurable parameters from constructor options', function __() {
    // Create some references to test against
    const testParser = {};

    const stub = new Source.Stub({}, {
      parser: testParser
    });

    expect(stub.name).to.equal('stub');
    expect(stub.type).to.equal('stub');

    expect(stub.parser).to.equal(testParser);
  });

  it('initialize returns a promise', function __() {
    const source = new Source.Stub();

    expect(source.initialize()).to.be.instanceOf(Promise);
  });

  it('initialized promise resolves when a response is received', function __(done) {
    const source = new Source.Stub();

    source.initialize().then(() => {
      expect(source.state).to.equal(Source.RUNNING);
      done();
    });
  });

  it('initialized promise resolves when a NO_EXIST is received', function __(done) {
    const source = new Source.NoExistStub();

    source.initialize().then(() => {
      expect(source.state).to.equal(Source.WAITING);
      done();
    });
  });

  it('initialized promise resolves when an error is received', function __(done) {
    const source = new Source.ErrorStub();

    source.initialize().then(() => {
      expect(source.state).to.equal(Source.ERROR);
      done();
    });
  });

  it('shuts down cleanly', (done) => {
    const source = new Source.Stub();

    source.once('shutdown', () => {
      expect(source.state).to.equal(Source.SHUTDOWN);
      expect(source._state).to.equal(null);
      done();
    });

    source.initialize().then(() => {
      source._state = 'non-null-value';
      source.shutdown();
    });
  });

  it('handles and emits errors from the underlying resource', function __(done) {
    const source = new Source.ErrorStub();

    source.once('error', (err) => {
      expect(err).to.be.instanceOf(Error);
      expect(source.state).to.equal(Source.ERROR);

      source.once('update', () => {
        expect(source.state).to.equal(Source.RUNNING);
        done();
      });
      source._update({});
    });

    source.initialize();
  });

  it('fakes inheritance checks through the Source Factory methods', function __() {
    expect(new Source.Stub()).to.be.instanceOf(Source.Common);
    expect(new Source.PollingStub()).to.be.instanceOf(Source.Common);
    expect(new Source.PollingStub()).to.be.instanceOf(Source.Common.Polling);
  });

  it('clears properties and state on NO_EXIST when INITIALIZING', function __() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.INITIALIZING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  it('clears properties and state on NO_EXIST when RUNNING', function __() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.RUNNING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  it('clears properties and state on NO_EXIST when WARNING', function __() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.WARNING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  it('clears properties and state on NO_EXIST when ERROR', function __() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.ERROR;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  it('clears properties and state on NO_EXIST when WAITING', function __() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.WAITING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  describe('Polling', function __() {
    it('sets an interval', function ___() {
      const stub = new Source.PollingStub({}, {
        interval: 42
      });

      expect(stub.interval).to.equal(42);
    });

    it('starts a timer when initialized', function ___(done) {
      const stub = new Source.PollingStub();

      stub.initialize().then(() => {
        expect(stub._timer).to.be.an('object');
        stub.shutdown();

        done();
      });
    });

    it('only creates one timer if initialized multiple times', function ___(done) {
      const stub = new Source.PollingStub();

      stub.initialize().then(() => {
        expect(stub._timer).to.be.an('object');

        const firstTimer = stub._timer;

        stub.initialize().then(() => {
          expect(stub._timer).to.equal(firstTimer);

          stub.shutdown();
          done();
        });
      });
    });

    it('clears its timer when shutdown', function ___(done) {
      const stub = new Source.PollingStub();

      stub.initialize().then(() => {
        expect(stub._timer).to.be.an('object');

        stub.shutdown();
        expect(stub._timer).to.equal(undefined);

        done();
      });
    });
  });
});
