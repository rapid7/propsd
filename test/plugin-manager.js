/* eslint-env mocha */
'use strict';

require('should');
const sinon = require('sinon');
const AWS = require('aws-sdk');

require('should-sinon');

const PluginManager = require('../lib/plugin-manager');
const StringTemplate = require('../lib/string-template');

const DEFAULT_INTERVAL = 60000;

const fakeIndexResponse = {
  ETag: 'ThisIsACoolEtag',
  Body: new Buffer(JSON.stringify(require('./data/s3/index')))
};

/* eslint-disable func-names, max-nested-callbacks */
describe('Plugin manager', function () {
  const unknownEndpointErr = new Error('UnknownEndpoint');
  const _S3 = AWS.S3;
  let manager,
      storage;

  beforeEach(function () {
    AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, fakeIndexResponse);

    storage = new (require('../lib/storage'))();
    manager = new PluginManager(storage, {
      interval: DEFAULT_INTERVAL,
      bucket: 'foo',
      path: 'bar',
      metadataHost: '127.0.0.1:8080'
    });
  });

  afterEach(function () {
    manager.shutdown();
    manager = null;
    storage = null;
    AWS.S3 = _S3;
  });

  it('fetches the index from S3 and gets a list of sources', function (done) {
    manager.once('sources-generated', (sources) => {
      const sourceObjs = sources.map((s) => {
        return {name: s.name, type: s.type};
      });

      sourceObjs.should.eql([{name: 'global', type: 's3'}, {name: 'account', type: 's3'}, {name: 'ami', type: 's3'}]);
      done();
    });

    manager.initialize();
  });

  it('correctly merges data from the metadata plugin with stringtemplate strings from the index', function (done) {
    manager.once('sources-generated', (sources) => {
      const amiPath = manager.index.properties.sources[2].parameters.path;
      const mergedAmiPath = sources[2].parameters.path;
      const t = StringTemplate.coerce(amiPath, manager.metadata.properties);

      t.should.equal(mergedAmiPath);
      done();
    });

    manager.initialize();
  });

  it('handles being presented with data that will be parsed into a badly interpolated StringTemplate', function (done) {
    const badIndex = require('./data/s3/index');

    badIndex.sources[2].parameters.path = '{{ instance:foo-bar }}.json';
    AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, {
      ETag: 'ThisIsACoolEtag',
      Body: new Buffer(JSON.stringify(badIndex))
    });

    manager.on('error', () => {
      AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, fakeIndexResponse);
      manager.once('sources-generated', (sources) => {
        const sourceObjs = sources.map((s) => {
          return {name: s.name, type: s.type};
        });

        sourceObjs.should.eql([{name: 'global', type: 's3'}, {name: 'account', type: 's3'}, {name: 'ami', type: 's3'}]);
        done();
      });
    });
    manager.updateDelay = 1;
    manager.initialize();
  });

  it('registers plugins with the storage engine', function (done) {
    manager.once('sources-registered', () => {
      const sourceNames = storage.sources.map((el) => el.name); // eslint-disable-line max-nested-callbacks

      sourceNames.should.eql(['s3-foo-global.json', 's3-foo-account/12345.json', 's3-foo-ami-4aface7a.json']);
      done();
    });

    manager.initialize();
  });

  it('sets event handlers for plugin events', function (done) {
    manager.once('source-instantiated', (instance) => {
      const updateSpy = sinon.spy(instance, '_update');

      instance.once('update', () => {
        updateSpy.should.be.called();
        done();
      });
    });

    manager.initialize();
  });

  it('handles source types that have not been implemented', function (done) {
    AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, {
      ETag: 'ThisIsACoolEtag',
      Body: new Buffer(JSON.stringify({
        version: 1.0,
        sources: [
          {name: 'global', type: 's3', parameters: {path: 'global.json'}},
          {name: 'global', type: 'someBrandNewSourceType', parameters: {path: 'global.json'}}
        ]
      }))
    });

    manager.once('error', (err) => {
      const status = manager.status();

      err.message.should.equal('Source type someBrandNewSourceType not implemented');
      status.ok.should.be.false();
      done();
    });

    manager.initialize();
  });

  it('retries Metadata source until it succeeds if the Metadata source fails', function (done) {
    manager.once('error', (err) => {
      const metadataStatus = manager.metadata.status();

      err.code.should.equal('ECONNREFUSED');
      manager.status().should.eql({running: true, ok: false, sources: []});
      metadataStatus.ok.should.be.false();
      metadataStatus.running.should.be.true();

      manager.metadata.service.host = '127.0.0.1:8080';
    });

    manager.once('sources-generated', (sources) => {
      const status = manager.status();

      status.running.should.be.true();
      status.ok.should.be.true();
      sources.length.should.equal(3); // eslint-disable-line rapid7/static-magic-numbers
      done();
    });

    manager.metadata.service.host = '0.0.0.0';
    manager.initialize();
  });

  it('retries S3 source until it succeeds if the S3 source fails', function (done) {
    AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, unknownEndpointErr, null);

    manager.once('error', (err) => {
      const indexStatus = manager.index.status();

      err.message.should.equal('UnknownEndpoint');
      manager.status().should.eql({running: true, ok: false, sources: []});
      indexStatus.ok.should.be.false();
      indexStatus.running.should.be.true();

      AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, fakeIndexResponse);
    });

    manager.once('sources-generated', (sources) => {
      const status = manager.status();

      status.running.should.be.true();
      status.ok.should.be.true();
      sources.length.should.equal(3); // eslint-disable-line rapid7/static-magic-numbers
      done();
    });

    manager.initialize();
  });

  // SECOND PULL REQUEST
  /* it('rebuilds sources when the index is updated', function (done) {
    // TODO: Rewrite this test
    const updatedSource = {
      ETag: 'ThisIsADifferentETag',
      Body: new Buffer(JSON.stringify({
        version: 1.0,
        sources: [{name: 'global', type: 's3', parameters: {path: 'global.json'}}]
      }))
    };
    let sources = [];

    manager.on('sources-registered', (storageSources) => {
      if (sources.length === 0) {
        sources = storageSources;
        AWS.S3.prototype.getObject = this.stub().callsArgWith(1, null, updatedSource);
      } else {
        done();
      }
      manager.update();
    });

    manager.index.on('update', () => {
      console.log(`${Date.now()}: index updated`);
    });

    manager.initialize();
  });

  it('updates the storage engine when the index removes a source plugin', function (done) {
    // TODO: Stub getObject to return an index that's missing one of the plugins, test that storage.sources contains
    // the updated plugins
    done();
  });

  it('updates the storage engine when the index adds a source plugin', function (done) {
    // TODO: Stub getObject to return an index that's missing one of the plugins, test that storage.sources contains
    // the updated plugins
    done();
  });

  it('exposes an error from source plugins when one occurs but continues running', function (done) {
    manager.once('source-instantiated', (instance) => {
      instance.on('error', (err) => {
        const status = manager.status();

        err.message.should.equal('UnknownEndpoint');
        status.running.should.be.true();
        done();
      });

      AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, unknownEndpointErr, null);
    });

    manager.initialize();
  }); */
});

/* eslint-enable func-names */
