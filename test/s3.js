/* eslint-env mocha */
/* global Config */
'use strict';

const should = require('should');
const sinon = require('sinon');

require('should-sinon');

const NON_DEFAULT_INTERVAL = 10000;
const DEFAULT_INTERVAL = 60000;
const DEFAULT_BUCKET = 'fake-bucket';
const s3Stub = require('./utils/s3-stub');

describe('S3 source plugin', () => {
  let S3,
      s3WithNoSuchKeyError,
      s3WithNotModifiedError,
      s3OtherError,
      shutdownSpy,
      s3SampleData;

  beforeEach((done) => {
    // Stub out all calls to AWS.S3.getObject
    const fakeResponse = {
      ETag: 'ThisIsACoolEtag',
      Body: new Buffer(JSON.stringify({properties: {a: 1, b: 'foo', c: {d: 0}}}))
    };

    S3 = s3Stub({
      getObject: sinon.stub().callsArgWith(1, null, fakeResponse)
    });

    this.s3 = new S3({bucket: DEFAULT_BUCKET, path: 'foo.json', interval: DEFAULT_INTERVAL});
    done();
  });

  afterEach(() => {
    this.s3.shutdown();
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
      this.s3._timer.should.have.keys(['_called', '_idleNext', '_idlePrev', '_idleStart', '_idleTimeout',
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
    this.s3.on('update', (source) => {
      source.properties.should.deepEqual({a: 1, b: 'foo', c: {d: 0}});
      done();
    });

    this.s3.initialize();
  });

  it('returns a properly formed status object', sinon.test((done) => {
    this.s3.on('update', () => {
      const status = this.s3.status();

      status.should.eql({
        ok: true,
        updated: new Date(),
        interval: DEFAULT_INTERVAL,
        running: true
      });
      done();
    });

    this.s3.initialize();
  }));

  before(() => {
    S3 = s3Stub({
      getObject: sinon.stub().callsArgWith(1, {code: 'NoSuchKey'}, null)
    });

    s3WithNoSuchKeyError = new S3({bucket: DEFAULT_BUCKET, path: 'foo.json'});
  });

  it('shuts down the source if getRequest returns a NoSuchKey error', (done) => {
    const errorSpy = sinon.spy();
    const updateSpy = sinon.spy();

    shutdownSpy = sinon.spy();

    s3WithNoSuchKeyError.on('error', errorSpy);
    s3WithNoSuchKeyError.on('update', updateSpy);
    s3WithNoSuchKeyError.on('shutdown', shutdownSpy);

    s3WithNoSuchKeyError.on('shutdown', () => {
      errorSpy.should.not.be.called();
      updateSpy.should.not.be.called();
      shutdownSpy.should.be.called();
      s3WithNoSuchKeyError.properties.should.be.empty();
      done();
    });

    s3WithNoSuchKeyError.initialize();
    s3WithNoSuchKeyError.properties = {foo: 'bar'};
  });

  it('clears cached properties if getRequest returns a NoSuchKey error', (done) => {
    S3 = s3Stub({
      getObject: sinon.stub().callsArgWith(1, {code: 'NoSuchKey'}, null)
    });

    s3WithNoSuchKeyError = new S3({bucket: DEFAULT_BUCKET, path: 'foo.json'});
    s3WithNoSuchKeyError.on('shutdown', () => {
      s3WithNoSuchKeyError.properties.should.be.empty();
      done();
    });

    s3WithNoSuchKeyError.initialize();
    s3WithNoSuchKeyError.properties = {foo: 'bar'};
  });

  before(() => {
    S3 = s3Stub({
      getObject: sinon.stub().callsArgWith(1, {code: 'NotModified'}, null)
    });

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

    S3 = s3Stub({
      getObject: sinon.stub().callsArgWith(1, errorObj, null)
    });

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
    s3OtherError.shutdown();
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
    this.s3.shutdown();
  });

  it('identifies as a \'s3\' source plugin', () => {
    this.s3.type.should.equal('s3');
  });

  before(() => {
    const fakeResponse = {
      ETag: 'ThisIsACoolEtag',
      Body: new Buffer(JSON.stringify(require('./data/s3/global')))
    };

    S3 = s3Stub({
      getObject: sinon.stub().callsArgWith(1, null, fakeResponse)
    });
    s3SampleData = new S3({bucket: DEFAULT_BUCKET, path: 'foo.json', interval: DEFAULT_INTERVAL});
  });
  it('correctly parses a sample document', (done) => {
    s3SampleData.once('update', (source) => {
      source.properties.should.deepEqual({
        global: 'global',
        account: 'account',
        region: 'region',
        vpc_id: 'vpc',
        produce: 'product',
        stack: 'stack',
        service: 'service',
        version: 'version',
        asg: 'asg',
        foo: 'bar',
        test: true,
        maxCassandraConnects: 0
      });
      done();
    });

    s3SampleData.initialize();
  });

  it('can clear its properties', (done) => {
    this.s3.on('update', () => {
      this.s3.clear();
      this.s3.properties.should.eql({});
      done();
    });

    this.s3.initialize();
  });

  it('can be configured with a different endpoint', () => {
    const endpoint = 'www.somecoolendpoint.com';
    const s3Source = require('../lib/source/s3');
    const s3 = new s3Source({ // eslint-disable-line new-cap
      bucket: DEFAULT_BUCKET,
      path: 'foo.json',
      interval: DEFAULT_INTERVAL,
      endpoint
    });

    s3.service.endpoint.hostname.should.equal(endpoint);
  });
});
