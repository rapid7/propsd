/* eslint-env mocha */
'use strict';

require('should');
const sinon = require('sinon');
const nconf = require('nconf');
const AWS = require('aws-sdk');
const generateConsulStub = require('./utils/consul-stub');

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
  this.timeout(5000); // eslint-disable-line rapid7/static-magic-numbers
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

    // Unregister listeners so tests error out cleanly.
    manager.removeAllListeners('error');
    manager.removeAllListeners('sources-registered');

    manager = null;
    storage = null;
    AWS.S3 = _S3;
  });

  it('fetches the index from S3 and gets a list of sources', function (done) {
    manager.once('sources-generated', (sources) => {
      const sourceObjs = sources.map((s) => {
        return {name: s.name, type: s.type};
      });

      sourceObjs.should.eql([
        {name: 'global', type: 's3'},
        {name: 'account', type: 's3'},
        {name: 'ami', type: 's3'},
        {name: 'consul', type: 'consul'}
      ]);
      done();
    });

    manager.initialize();
  });

  it('correctly merges data from the metadata plugin with stringtemplate strings from the index', function (done) {
    manager.once('sources-generated', (sources) => {
      const amiPath = manager.index.properties[2].parameters.path;
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

    manager.once('error', () => {
      AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, fakeIndexResponse);
    });

    manager.once('sources-generated', (sources) => {
      const sourceObjs = sources.map((s) => {
        return {name: s.name, type: s.type};
      });

      sourceObjs.should.eql([
        {name: 'global', type: 's3'},
        {name: 'account', type: 's3'},
        {name: 'ami', type: 's3'},
        {name: 'consul', type: 'consul'}
      ]);
      done();
    });

    manager.index.interval = 1;
    manager.initialize();
  });

  it('registers plugins with the storage engine', function (done) {
    manager.once('sources-registered', () => {
      const sourceNames = storage.sources.map((el) => el.name); // eslint-disable-line max-nested-callbacks

      sourceNames.should.eql(['s3-foo-global.json', 's3-foo-account/12345.json', 's3-foo-ami-4aface7a.json', 'consul']);
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
    function onConnectionRefused(err) {
      if (err.code === 'ECONNREFUSED') {
        manager.removeListener('error', onConnectionRefused);

        const metadataStatus = manager.metadata.status();
        const managerStatus = manager.status();

        managerStatus.running.should.be.true();
        managerStatus.ok.should.be.false();
        metadataStatus.ok.should.be.false();
        metadataStatus.running.should.be.true();

        manager.metadata.service.host = '127.0.0.1:8080';
      }
    }

    manager.on('error', onConnectionRefused);

    manager.once('sources-generated', (sources) => {
      const status = manager.status();

      status.running.should.be.true();
      status.ok.should.be.true();
      sources.length.should.equal(4); // eslint-disable-line rapid7/static-magic-numbers
      done();
    });

    manager.metadata.service.host = '0.0.0.0';
    manager.metadata.interval = 1;
    manager.initialize();
  });

  it('retries S3 source until it succeeds if the S3 source fails', function (done) {
    AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, unknownEndpointErr, null);

    function onUnknownEndpoint(err) {
      if (err.message === 'UnknownEndpoint') {
        manager.removeListener('error', onUnknownEndpoint);

        const indexStatus = manager.index.status();
        const managerStatus = manager.status();

        managerStatus.running.should.be.true();
        managerStatus.ok.should.be.false();
        indexStatus.ok.should.be.false();
        indexStatus.running.should.be.true();

        AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, fakeIndexResponse);
      }
    }

    manager.on('error', onUnknownEndpoint);

    manager.once('sources-generated', (sources) => {
      const status = manager.status();

      status.running.should.be.true();
      status.ok.should.be.true();
      sources.length.should.equal(4); // eslint-disable-line rapid7/static-magic-numbers
      done();
    });

    manager.index.interval = 1;
    manager.initialize();
  });

  it('only allows one instance of the consul source', (done) => {
    const indexWithMultipleConsulSources = JSON.parse(fakeIndexResponse.Body.toString());

    // Add a bunch of consul sources
    for (let i = 0; i < 10; i++) { // eslint-disable-line rapid7/static-magic-numbers
      indexWithMultipleConsulSources.sources.push({name: 'consul', type: 'consul'});
    }
    AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, {
      ETag: 'ThisIsADifferentETag',
      Body: new Buffer(JSON.stringify(indexWithMultipleConsulSources))
    });

    manager.on('source-registered', (instance) => {
      if (instance.type === 'consul') {
        // We need to stub all consul sources
        manager.storage.sources.forEach((el, i) => {
          if (el.type === 'consul') {
            manager.storage.sources[i] = generateConsulStub();
          }
        });
      }
    });

    manager.once('sources-registered', (sources) => {
      const sourceTypes = sources.filter((el) => el.type === 'consul');

      sourceTypes.length.should.equal(1);
      done();
    });

    manager.initialize();
  });

  it('rebuilds sources when the index is updated', function (done) {
    const s3Sources = [];

    function addS3Source(name) {
      s3Sources.push({
        name, type: 's3', parameters: {path: `${name}.json`}
      });

      AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, {
        ETag: `v${s3Sources.length}`,
        Body: new Buffer(JSON.stringify({version: 1.0, sources: s3Sources}))
      });
    }

    manager.once('sources-registered', (storageSources) => {
      storageSources.length.should.equal(1);
      addS3Source('local');
      manager.once('sources-registered', (s) => {
        s.length.should.equal(2);
        done();
      });
    });

    addS3Source('global');
    manager.index.interval = 1;
    manager.initialize();
  });

  it('updates the storage engine when the index removes a source plugin', function (done) {
    let s3Sources = [{
      name: 'global', type: 's3', parameters: {path: 'global.json'}
    }, {
      name: 'local', type: 's3', parameters: {path: 'local.json'}
    }];

    AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, {
      ETag: `v${s3Sources.length}`,
      Body: new Buffer(JSON.stringify({version: 1.0, sources: s3Sources}))
    });

    function removeS3Source(name) {
      s3Sources = s3Sources.filter((source) => {
        return source.name !== name;
      });

      AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, {
        ETag: `v${s3Sources.length}`,
        Body: new Buffer(JSON.stringify({version: 1.0, sources: s3Sources}))
      });
    }

    function onSourcesRegistered(storageSources) {
      if (storageSources.length === 2) {
        storageSources.map((source) => {
          return source.name;
        }).sort().should.eql(['s3-foo-global.json', 's3-foo-local.json']);
        removeS3Source('local');
      }

      if (storageSources.length === 1) {
        manager.removeListener('sources-registered', onSourcesRegistered);
        storageSources.map((source) => {
          return source.name;
        }).sort().should.eql(['s3-foo-global.json']);
        done();
      }
    }

    manager.on('sources-registered', onSourcesRegistered);
    manager.index.interval = 1;
    manager.initialize();
  });

  it('updates the storage engine when the index adds a source plugin', function (done) {
    const s3Sources = [];

    function addS3Source(name) {
      s3Sources.push({
        name, type: 's3', parameters: {path: `${name}.json`}
      });

      AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, null, {
        ETag: `v${s3Sources.length}`,
        Body: new Buffer(JSON.stringify({version: 1.0, sources: s3Sources}))
      });
    }

    function onSourcesRegistered(storageSources) {
      if (storageSources.length === 1) {
        storageSources.map((source) => {
          return source.name;
        }).should.containEql('s3-foo-global.json');
        addS3Source('local');
      }

      if (storageSources.length === 2) {
        manager.removeListener('sources-registered', onSourcesRegistered);
        storageSources.map((source) => {
          return source.name;
        }).should.containEql('s3-foo-local.json');
        done();
      }
    }

    addS3Source('global');
    manager.on('sources-registered', onSourcesRegistered);
    manager.index.interval = 1;
    manager.initialize();
  });

  it('exposes an error from source plugins when one occurs but continues running', function (done) {
    function onUnknownEndpoint(err) {
      if (err.message === 'UnknownEndpoint') {
        manager.removeListener('error', onUnknownEndpoint);

        manager.status().running.should.be.true();
        done();
      }
    }

    manager.on('error', onUnknownEndpoint);

    manager.once('source-instantiated', () => {
      AWS.S3.prototype.getObject = sinon.stub().callsArgWith(1, unknownEndpointErr, null);
    });

    manager.initialize();
  });

  it('handles alternate metadata source configuration', function (done) {
    global.Config = nconf.argv().env();
    global.Config.set('properties', {
      foo: 'bar',
      baz: 'quiz'
    });

    manager.metadata.once('update', () => {
      manager.metadata.properties.should.have.ownProperty('foo');
      manager.metadata.properties.should.have.ownProperty('baz');
      done();
    });

    manager.initialize();
  });
});

/* eslint-enable func-names, max-nested-callbacks */
