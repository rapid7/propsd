'use strict';

require('./lib/helpers');

const Source = require('./lib/stub/source');
const expect = require('chai').expect;

describe('Source/Common', function() {
  it('sets configurable parameters from constructor options', function() {
    // Create some references to test against
    const testParser = {};

    const stub = new Source.Stub('stub', {
      parser: testParser
    });

    expect(stub.name).to.equal('stub');
    expect(stub.type).to.equal('stub');

    expect(stub.parser).to.equal(testParser);
  });

  it('initialize returns a promise', function() {
    const source = new Source.Stub();

    expect(source.initialize()).to.be.instanceOf(Promise);
  });

  it('initialized promise resolves when a response is received', function() {
    const source = new Source.Stub();

    return source.initialize().then(() => {
      expect(source.state).to.equal(Source.RUNNING);
    });
  });

  it('initialized promise resolves when a NO_EXIST is received', function() {
    const source = new Source.NoExistStub();

    return source.initialize().then(() => {
      expect(source.state).to.equal(Source.WAITING);
    });
  });

  it('initialized promise resolves when an error is received', function() {
    const source = new Source.ErrorStub();

    return source.initialize().then(() => {
      expect(source.state).to.equal(Source.ERROR);
    });
  });

  it('shuts down cleanly', function(done) {
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

  it('handles and emits errors from the underlying resource', function(done) {
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

  it('fakes inheritance checks through the Source Factory methods', function() {
    expect(new Source.Stub()).to.be.instanceOf(Source.Common);
    expect(new Source.PollingStub()).to.be.instanceOf(Source.Common);
    expect(new Source.PollingStub()).to.be.instanceOf(Source.Common.Polling);
  });

  it('clears properties and state on NO_EXIST when INITIALIZING', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.INITIALIZING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  it('clears properties and state on NO_EXIST when RUNNING', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.RUNNING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  it('clears properties and state on NO_EXIST when WARNING', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.WARNING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  it('clears properties and state on NO_EXIST when ERROR', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.ERROR;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  it('clears properties and state on NO_EXIST when WAITING', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.WAITING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    expect(source.state).to.eql(Source.Common.WAITING);
    expect(source.properties).to.eql({});
    expect(source._state).to.eql(null);
  });

  describe('Polling', function() {
    it('sets an interval', function() {
      const stub = new Source.PollingStub({}, {
        interval: 42
      });

      expect(stub.interval).to.equal(42);
    });

    it('starts a timer when initialized', function(done) {
      const stub = new Source.PollingStub();

      stub.initialize().then(() => {
        expect(stub._timer).to.be.an('object');
        stub.shutdown();

        done();
      });
    });

    it('only creates one timer if initialized multiple times', function() {
      const stub = new Source.PollingStub();

      return stub.initialize().then(() => {
        expect(stub._timer).to.be.an('object');

        const firstTimer = stub._timer;

        return stub.initialize().then(() => {
          expect(stub._timer).to.equal(firstTimer);

          stub.shutdown();
        });
      });
    });

    it('clears its timer when shutdown', function() {
      const stub = new Source.PollingStub();

      return stub.initialize().then(() => {
        expect(stub._timer).to.be.an('object');

        stub.shutdown();
        expect(stub._timer).to.equal(undefined);
      });
    });
  });
});
