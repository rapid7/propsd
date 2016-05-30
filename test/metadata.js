/* eslint-env mocha */
/* global Config */
'use strict';

const should = require('should');
const Path = require('path');
const fs = require('fs');

const Metadata = require('../lib/source/metadata');
const Source = require('../lib/source/common');
const fakeMetadata = JSON.parse(fs.readFileSync(Path.resolve(__dirname, './data/test-metadata.json')));

const NON_DEFAULT_INTERVAL = 10000;

describe('Metadata source plugin', () => {
  beforeEach(() => {
    this.m = new Metadata();
    this.m.service.host = '127.0.0.1:8080';
  });

  afterEach(() => {
    this.m.shutdown();
  });

  it('creates a Metadata source instance with a non-default timer interval', () => {
    const m = new Metadata({
      interval: NON_DEFAULT_INTERVAL
    });

    m.interval.should.equal(NON_DEFAULT_INTERVAL);
  });

  it('initializes a timer with the set interval', (done) => {
    this.m.once('update', () => {
      this.m._timer.should.have.keys(['_called', '_idleNext', '_idlePrev', '_idleStart', '_idleTimeout',
        '_onTimeout', '_repeat']);
      done();
    });

    this.m.initialize();
  });

  it('munges a set of paths to create a valid data object', (done) => {
    this.m.once('update', () => {
      const instance = this.m.properties.instance;
      const fake = fakeMetadata.latest['meta-data'];
      const creds = JSON.parse(fake.iam['security-credentials']['fake-role-name']);

      instance['ami-id'].should.equal(fake['ami-id']);
      instance.hostname.should.equal(fake.hostname);
      instance.identity.document.should.equal(fakeMetadata.latest.dynamic['instance-identity'].document);
      instance.credentials.lastUpdated.should.equal(creds.LastUpdated);

      done();
    });

    this.m.initialize();
  });

  it('shuts down cleanly', (done) => {
    this.m.once('shutdown', () => {
      const status = this.m.status();

      status.state.should.equal(Source.SHUTDOWN);
      done();
    });

    this.m.initialize();
    this.m.shutdown();
  });

  it('initialize returns a promise', () => {
    this.m.initialize().should.be.instanceOf(Promise);
  });

  it('clears the sha1 signature when it\'s shutdown', (done) => {
    this.m.once('shutdown', () => {
      should(this.m.signature).be.null();
      done();
    });

    this.m.initialize();
    this.m.shutdown();
  });

  it('doesn\'t update data if the Metadata Service document is the same', (done) => {
    let instanceId = null,
        signature = null,
        secondExecution = false;

    this.m.once('update', () => {
      instanceId = this.m.properties.instance['ami-id'];
      signature = this.m.signature;

      secondExecution = true;
    });

    this.m.once('no-update', () => {
      if (secondExecution) {
        this.m.properties.instance['ami-id'].should.equal(instanceId);
        this.m.signature.should.equal(signature);
        done();
      }
    });

    this.m.interval = 100;
    this.m.initialize();
  });

  it('exposes an error when one occurs but continues running', (done) => {
    this.m.service.host = '0.0.0.0';
    this.m.once('error', (err) => {
      const status = this.m.status();

      err.code.should.equal('ECONNREFUSED');
      status.ok.should.be.false();
      status.state.should.equal(Source.ERROR);
      done();
    });

    this.m.initialize();
  });

  it('identifies as a \'ec2-metadata\' source plugin', () => {
    this.m.type.should.equal('ec2-metadata');
  });

  after(() => {
    this.m.service.host = '127.0.0.1:8080';
  });
});
