'use strict';

require('./lib/helpers');

const Source = require('./lib/stub/source');
const should = require('should');
const nock = require('nock');

describe('Source/Common', function() {
  before(function() {
    nock.disableNetConnect();
  });

  after(function() {
    nock.enableNetConnect();
  });

  it('sets configurable parameters from constructor options', function() {
    // Create some references to test against
    const testParser = {};

    const stub = new Source.Stub('stub', {
      parser: testParser
    });

    stub.name.should.eql('stub');
    stub.type.should.eql('stub');

    stub.parser.should.eql(testParser);
  });

  it('initialize returns a promise', function() {
    const source = new Source.Stub();

    source.initialize().should.be.a.Promise();
  });

  it('initialized promise resolves when a response is received', function() {
    const source = new Source.Stub();

    return source.initialize()
      .then(() => {
        source.state.should.eql(Source.RUNNING);
      });
  });

  it('initialized promise resolves when a NO_EXIST is received', function() {
    const source = new Source.NoExistStub();

    return source.initialize().then(() => {
      source.state.should.eql(Source.WAITING);
    });
  });

  it('initialized promise resolves when an error is received', function() {
    const source = new Source.ErrorStub();

    return source.initialize().then(() => {
      source.state.should.eql(Source.ERROR);
    });
  });

  it('should shuts down cleanly', function() {
    const source = new Source.Stub();

    return source.initialize()
      .then(() => {
        source.state.should.eql(Source.RUNNING);

        return Promise.resolve(source.shutdown());
      })
      .then(() => {
        source.state.should.eql(Source.SHUTDOWN);
        should(source._state).eql(null);
      });
  });

  it('handles and emits errors from the underlying resource', function(done) {
    const source = new Source.ErrorStub();

    source.once('error', (err) => {
      err.should.be.an.Error();
      source.state.should.eql(Source.ERROR);

      source.once('update', () => {
        source.state.should.eql(Source.RUNNING);
        done();
      });
      source._update({});
    });

    source.initialize();
  });

  it('fakes inheritance checks through the Source Factory methods', function() {
    (new Source.Stub()).should.be.instanceOf(Source.Common);
    (new Source.PollingStub()).should.be.instanceOf(Source.Common);
    (new Source.PollingStub()).should.be.instanceOf(Source.Common.Polling);
  });

  it('clears properties and state on NO_EXIST when INITIALIZING', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.INITIALIZING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    source.state.should.eql(Source.Common.WAITING);
    source.properties.should.be.an.Object();
    source.properties.should.be.empty();
    should(source._state).be.null();
  });

  it('clears properties and state on NO_EXIST when RUNNING', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.RUNNING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    source.state.should.eql(Source.Common.WAITING);
    source.properties.should.be.an.Object();
    source.properties.should.be.empty();
    should(source._state).be.null();
  });

  it('clears properties and state on NO_EXIST when WARNING', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.WARNING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    source.state.should.eql(Source.Common.WAITING);
    source.properties.should.be.an.Object();
    source.properties.should.be.empty();
    should(source._state).be.null();
  });

  it('clears properties and state on NO_EXIST when ERROR', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.ERROR;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    source.state.should.eql(Source.Common.WAITING);
    source.properties.should.be.an.Object();
    source.properties.should.be.empty();
    should(source._state).be.null();
  });

  it('clears properties and state on NO_EXIST when WAITING', function() {
    const source = new Source.Stub({key: 'value'});

    source.state = Source.Common.WAITING;
    source._state = 'non-null-value';

    source._update(Source.Common.NO_EXIST);

    source.state.should.eql(Source.Common.WAITING);
    source.properties.should.be.an.Object();
    source.properties.should.be.empty();
    should(source._state).be.null();
  });

  describe('Polling', function() {
    it('sets an interval', function() {
      const stub = new Source.PollingStub({}, {
        interval: 42
      });

      stub.interval.should.equal(42);
    });

    it('starts a timer when initialized', function(done) {
      const stub = new Source.PollingStub();

      stub.initialize().then(() => {
        stub._timer.should.be.an.Object();
        stub.shutdown();

        done();
      });
    });

    it('only creates one timer if initialized multiple times', function() {
      const stub = new Source.PollingStub();

      return stub.initialize().then(() => {
        stub._timer.should.be.an.Object();

        const firstTimer = stub._timer;

        return stub.initialize().then(() => {
          stub._timer.should.eql(firstTimer);

          stub.shutdown();
        });
      });
    });

    it('clears its timer when shutdown', function() {
      const stub = new Source.PollingStub();

      return stub.initialize().then(() => {
        stub._timer.should.be.an.Object();

        stub.shutdown();
        should(stub._timer).be.undefined();
      });
    });
  });
});
