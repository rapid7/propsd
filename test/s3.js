'use strict';

/* eslint-env mocha */
/* global Config, Log */
/* eslint-disable max-nested-callbacks */

require('./lib/helpers');

const should = require('should');
const sinon = require('sinon');

require('should-sinon');

const NON_DEFAULT_INTERVAL = 10000;
const DEFAULT_INTERVAL = 60000;
const DEFAULT_BUCKET = 'fake-bucket';

const Source = require('../lib/source/common');
const s3Stub = require('./utils/s3-stub');

/* eslint-disable func-names, max-nested-callbacks */
describe('S3 source plugin', function () {
  this.timeout(2000); // eslint-disable-line rapid7/static-magic-numbers

  const fakeResponse = {
    ETag: 'ThisIsACoolEtag',
    Body: new Buffer(JSON.stringify({properties: {a: 1, b: 'foo', c: {d: 0}}}))
  };

  const S3 = s3Stub({
    getObject: sinon.stub().callsArgWith(1, null, fakeResponse)
  });

  beforeEach((done) => {
    this.s3 = new S3('foo.json', {bucket: DEFAULT_BUCKET, path: 'foo.json', interval: DEFAULT_INTERVAL});
    done();
  });

  afterEach(() => {
    this.s3.shutdown();
  });

  it('throws an error if instantiated without bucket or path', () => {
    should.throws(() => {
      new S3('test'); // eslint-disable-line no-new
    }, Error);

    should.throws(() => {
      new S3('test', {  // eslint-disable-line no-new
        bucket: DEFAULT_BUCKET
      });
    }, Error);
  });

  it('creates an S3 source instance with a non-default timer interval', () => {
    const s3 = new S3('foo.json', {interval: NON_DEFAULT_INTERVAL, bucket: DEFAULT_BUCKET, path: 'foo.json'});

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

      status.state.should.equal(Source.SHUTDOWN);
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

  it('returns a properly formed status object', (done) => {
    this.s3.on('update', () => {
      const status = this.s3.status();

      status.ok.should.equal(true);
      status.updated.should.be.instanceOf(Date);
      status.interval.should.equal(DEFAULT_INTERVAL);
      status.state.should.equal(Source.RUNNING);

      done();
    });

    this.s3.initialize();
  });

  it('clears cached properties if getRequest returns a NoSuchKey error', (done) => {
    const Stub = s3Stub({getObject: sinon.stub().callsArgWith(1, {code: 'NoSuchKey'}, null)});
    const s3WithNoSuchKeyError = new Stub('foo.json', {bucket: DEFAULT_BUCKET, path: 'foo.json'});

    s3WithNoSuchKeyError.once('update', () => {
      s3WithNoSuchKeyError.properties.should.be.empty();
      done();
    });

    s3WithNoSuchKeyError.properties = {foo: 'bar'};
    s3WithNoSuchKeyError.state = Source.RUNNING;

    // Bypasss #initialize state check
    s3WithNoSuchKeyError.start();
  });

  it('doesn\'t do anything if getRequest returns a NotModified error', (done) => {
    const errorSpy = sinon.spy();
    const updateSpy = sinon.spy();

    const Stub = s3Stub({getObject: sinon.stub().callsArgWith(1, {code: 'NotModified'}, null)});
    const s3WithNotModifiedError = new Stub('foo.json', {bucket: DEFAULT_BUCKET, path: 'foo.json'});

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

  it('exposes an error when any other type occurs but continues running', (done) => {
    const Stub = s3Stub({
      getObject: sinon.stub().callsArgWith(1, {code: 'BigTimeErrorCode', message: 'This is the error message'}, null)
    });
    const s3OtherError = new Stub('foo.json', {bucket: DEFAULT_BUCKET, path: 'foo.json'});

    s3OtherError.on('error', (err) => {
      const status = s3OtherError.status();

      status.ok.should.be.false();
      status.state.should.equal(Source.ERROR);
      err.code.should.equal('BigTimeErrorCode');
      done();
    });

    s3OtherError.initialize();
  });

  it('can\'t shutdown a plugin that\'s already shut down', (done) => {
    const shutdownSpy = sinon.spy();

    this.s3.on('shutdown', shutdownSpy);
    this.s3.on('shutdown', () => {
      shutdownSpy.should.be.calledOnce();
      done();
    });
    this.s3.initialize();
    this.s3.shutdown();
    this.s3.shutdown();
  });

  it('can only be initialized once', (done) => {
    this.s3.initialize();
    this.s3.state.should.equal(Source.INITIALIZING);

    this.s3.once('update', () => {
      this.s3.state.should.equal(Source.RUNNING);
      this.s3.initialize();
      this.s3.state.should.equal(Source.RUNNING);

      done();
    });
  });

  it('identifies as a \'s3\' source plugin', () => {
    this.s3.type.should.equal('s3');
  });

  it('correctly parses a sample document', (done) => {
    const Stub = s3Stub({getObject: sinon.stub().callsArgWith(1, null, {
      ETag: 'ThisIsACoolEtag',
      Body: new Buffer(JSON.stringify(require('./data/s3/global')))
    })});

    const s3SampleData = new Stub('foo.json', {bucket: DEFAULT_BUCKET, path: 'foo.json', interval: DEFAULT_INTERVAL});

    s3SampleData.once('update', () => {
      s3SampleData.properties.should.deepEqual({
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

  it('can be configured with a different endpoint', () => {
    // Clear the require cache to avoid getting a proxied Aws.S3 object.
    Object.keys(require.cache).forEach((key) => {
      if (key.indexOf('lib/source/s3') > -1) {
        delete require.cache[key];
      }
    });

    const endpoint = 'www.somecoolendpoint.com';
    const s3Source = require('../lib/source/s3');
    const s3 = new s3Source('foo.json', { // eslint-disable-line new-cap
      bucket: DEFAULT_BUCKET,
      path: 'foo.json',
      interval: DEFAULT_INTERVAL,
      endpoint
    });

    s3.service.endpoint.hostname.should.equal(endpoint);
  });
});
