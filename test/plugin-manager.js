/* eslint-env mocha */
'use strict';

require('should');
const sinon = require('sinon');

require('should-sinon');

const s3Stub = require('./utils/s3-stub');

const PluginManager = require('../lib/plugin-manager');
const StringTemplate = require('../lib/string-template');

const DEFAULT_INTERVAL = 30000;

/* eslint-disable func-names */
describe('Plugin manager', sinon.test(function () {
  let S3,
      manager,
      storage;

  beforeEach(function () {
    // Stub out all calls to AWS.S3.getObject
    const fakeResponse = {
      ETag: 'ThisIsACoolEtag',
      Body: new Buffer(JSON.stringify(require('./data/plugin-manager/index')))
    };

    storage = new (require('../lib/storage'))();
    manager = new PluginManager(storage);

    S3 = s3Stub({
      getObject: sinon.stub().callsArgWith(1, null, fakeResponse)
    });

    manager.index = new S3({
      interval: DEFAULT_INTERVAL,
      bucket: 'foo',
      path: 'bar'
    });
    manager.metadata.service.host = '127.0.0.1:8080';
  });

  afterEach(function () {
    manager.shutdown();
    manager = null;
    storage = null;
  });

  it('fetches the index from S3 and gets a list of sources', function (done) {
    manager.on('sources-generated', (sources) => {
      const sourceObjs = sources.map((s) => { // eslint-disable-line max-nested-callbacks
        return {name: s.name, type: s.type};
      });

      sourceObjs.should.eql([{name: 'global', type: 's3'}, {name: 'account', type: 's3'}, {name: 'ami', type: 's3'}]);
      done();
    });

    manager.init();
  });

  it('correctly merges data from the metadata plugin with stringtemplate strings from the index', function (done) {
    manager.on('sources-generated', (sources) => {
      const amiPath = manager.index.properties.sources[2].parameters.path;
      const mergedAmiPath = sources[2].parameters.path;
      const t = StringTemplate.coerce(amiPath, manager.metadata.properties);

      t.should.equal(mergedAmiPath);
      done();
    });

    manager.init();
  });

  it('registers plugins with the storage engine', function (done) {
    manager.on('sources-registered', () => {
      const sourceNames = storage.sources.map((el) => {
        return el.name;
      });

      sourceNames.should.eql(['s3-foo-global.json', 's3-foo-account/12345.json', 's3-foo-ami-4aface7a.json']);
      done();
    });

    manager.init();
  });

  it('sets event handlers for plugin events', function (done) {
    manager.once('sources-registered', () => {
      storage.sources.forEach((source) => { // eslint-disable-line max-nested-callbacks
        source.listeners('update').length.should.equal(1);
      });
      done();
    });

    manager.init();
  });

  it('exposes an error when one occurs but continues running', function (done) {
    // TODO: Figure out what makes a "running" PluginManager.
    // Is a failure in either of its underlying sources enough to change it's status?
    // What are the consequences of a non-running PluginManager?
    manager.metadata.service.host = '0.0.0.0';
    manager.on('error', (err) => {
      err.code.should.equal('ECONNREFUSED');
      done();
    });

    manager.init();
  });
}));

/* eslint-enable func-names */
