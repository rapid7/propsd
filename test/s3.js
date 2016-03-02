/* eslint-env mocha */
/* global Config */
'use strict';

const Path = require('path');
const winston = require('winston');
const should = require('should');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

require('should-sinon');

global.Config = require('../lib/config').load(Path.resolve(__dirname, './data/config.json'));

global.Log = require('../lib/logger').attach(global.Config);
global.Log.remove(winston.transports.Console);

const NON_DEFAULT_INTERVAL = 10000;
const DEFAULT_BUCKET = 'fake-bucket';

function generateProxy(stub) {
  return proxyquire('../lib/source/s3', {
    'aws-sdk': {
      S3: function constructor() {
        return {getObject: stub
        };
      }
    }
  });
}

describe('S3 source plugin', () => {
  let S3,
      getObjectStub,
      s3WithNoSuchKeyError,
      s3WithNotModifiedError,
      s3OtherError,
      shutdownSpy;

  beforeEach((done) => {
    // Stub out all calls to AWS.S3.getObject
    const fakeResponse = {
      ETag: 'ThisIsACoolEtag',
      Body: new Buffer(JSON.stringify({a: 1, b: 'foo', c: {d: 0}}))
    };

    getObjectStub = sinon.stub().callsArgWith(1, null, fakeResponse);
    S3 = generateProxy(getObjectStub);

    this.s3 = new S3({bucket: DEFAULT_BUCKET, path: 'foo.json'});
    done();
  });

  it('throws an error if instantiated without bucket or path', () => {
    should.throws(() => {
      const s3 = new S3(); // eslint-disable-line no-unused-vars
    }, Error);

    should.throws(() => {
      const s3 = new S3({  // eslint-disable-line no-unused-vars
        bucket: DEFAULT_BUCKET
      });
    }, Error);
  });

  it('creates an S3 source instance with a non-default timer interval', () => {
    const s3 = new S3({interval: NON_DEFAULT_INTERVAL, bucket: DEFAULT_BUCKET, path: 'foo.json'});

    s3.interval.should.equal(NON_DEFAULT_INTERVAL);
  });

  it('initializes a timer with the set interval', (done) => {
    this.s3.on('update', () => {
      const status = this.s3.status();

      status.interval.should.have.keys(['_called', '_idleNext', '_idlePrev', '_idleStart', '_idleTimeout',
        '_onTimeout', '_repeat']);
      done();
    });

    this.s3.initialize();
  });

  it('shuts down cleanly', (done) => {
    this.s3.on('shutdown', () => {
      const status = this.s3.status();

      status.running.should.be.false();
      done();
    });

    this.s3.initialize();
    this.s3.shutdown();
  });

  it('parses a buffer from S3 to a JSON object', (done) => {
    this.s3.on('update', () => {
      this.s3.properties.should.deepEqual({a: 1, b: 'foo', c: {d: 0}});
      done();
    });

    this.s3.initialize();
  });

  before(() => {
    getObjectStub = sinon.stub().callsArgWith(1, {code: 'NoSuchKey'}, null);
    S3 = generateProxy(getObjectStub);

    s3WithNoSuchKeyError = new S3({bucket: DEFAULT_BUCKET, path: 'foo.json'});
  });

  it('doesn\'t do anything if getRequest returns a NoSuchKey error', (done) => {
    const errorSpy = sinon.spy();
    const updateSpy = sinon.spy();

    s3WithNoSuchKeyError.on('error', errorSpy);
    s3WithNoSuchKeyError.on('update', updateSpy);

    s3WithNoSuchKeyError.on('shutdown', () => {
      errorSpy.should.not.be.called();
      updateSpy.should.not.be.called();
      done();
    });

    s3WithNoSuchKeyError.initialize();
    s3WithNoSuchKeyError.shutdown();
  });

  before(() => {
    getObjectStub = sinon.stub().callsArgWith(1, {code: 'NotModified'}, null);
    S3 = generateProxy(getObjectStub);

    s3WithNotModifiedError = new S3({bucket: DEFAULT_BUCKET, path: 'foo.json'});
  });

  it('doesn\'t do anything if getRequest returns a NotModified error', (done) => {
    const errorSpy = sinon.spy();
    const updateSpy = sinon.spy();

    s3WithNotModifiedError.on('error', errorSpy);
    s3WithNotModifiedError.on('update', updateSpy);

    s3WithNotModifiedError.on('shutdown', () => {
      errorSpy.should.not.be.called();
      updateSpy.should.not.be.called();
      done();
    });

    s3WithNotModifiedError.initialize();
    s3WithNotModifiedError.shutdown();
  });

  before(() => {
    const errorObj = {code: 'BigTimeErrorCode', message: 'This is the error message'};

    getObjectStub = sinon.stub().callsArgWith(1, errorObj, null);
    S3 = generateProxy(getObjectStub);

    s3OtherError = new S3({bucket: DEFAULT_BUCKET, path: 'foo.json'});
  });
  it('exposes an error when any other type occurs but continues running', (done) => {
    s3OtherError.on('error', (err) => {
      const status = s3OtherError.status();

      status.ok.should.be.false();
      status.running.should.be.true();
      err.code.should.equal('BigTimeErrorCode');
      done();
    });

    s3OtherError.initialize();
  });

  it('can\'t shutdown a plugin that\'s already shut down', (done) => {
    shutdownSpy = sinon.spy();

    this.s3.on('shutdown', shutdownSpy);
    this.s3.on('shutdown', () => {
      shutdownSpy.should.be.calledOnce();
      done();
    });
    this.s3.initialize();
    this.s3.shutdown();
    this.s3.shutdown();
  });

  it('can only be initialized once', () => {
    this.s3.initialize();
    this.s3.should.deepEqual(this.s3.initialize());
  });

  it('identifies as a \'s3\' source plugin', () => {
    this.s3.type.should.equal('s3');
  });
});
