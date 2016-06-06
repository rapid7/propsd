/* eslint-env mocha */
/* eslint-disable rapid7/static-magic-numbers, max-nested-callbacks */
'use strict';

require('./lib/helpers');

const Source = require('./lib/stub/source');
const expect = require('chai').expect;

describe('Source/Common', function _() {
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
});
