/* eslint-env mocha */
/* global Config */
'use strict';

const path = require('path');
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const should = require('should');
const File = require('../lib/source/file');
const FILE_TO_WATCH = path.resolve(__dirname, './data/file-source-data.json');
const FILE_CONTENTS = require(FILE_TO_WATCH);
const UPDATED_PROPS = {
  version: 1.0,
  properties: {
    foo: 'bar',
    test: true,
    food: [
      {name: 'tacos', location: 'truck', delicious: true},
      {name: 'ice cream', location: 'stand', delicious: true},
      {name: 'undercooked chicken', location: 'my stove', delicious: false}
    ]
  }
};

describe('File source', () => {
  let f;

  beforeEach(() => {
    f = new File({path: FILE_TO_WATCH});
  });

  it('is created with a file path and throws an error if one isn\'t supplied', () => {
    should.doesNotThrow(() => {
      f = new File({path: FILE_TO_WATCH}); // eslint-disable-line no-unused-vars
    });

    should.throws(() => {
      f = new File(); // eslint-disable-line no-unused-vars
    }, Error, 'No path supplied');
  });

  it('requires a path to a valid file', () => {
    should.throws(() => {
      f = new File({path: path.relative(__dirname, './data/nonexistentfile.json')});
    }, Error, 'ENOENT: no such file or directory, access \'../data/nonexistentfile.json\'');
  });

  it('throws an error if a directory path is supplied', () => {
    should.throws(() => {
      f = new File({path: path.relative(__dirname, 'data/s3')});
    }, Error, 'ENOENT: no such file or directory, access \'../data/s3\'');
  });

  it('sets a FSWatcher on the file it should be watching', (done) => {
    f.once('update', () => {
      f.service.constructor.name.should.equal('FSWatcher');
      (f.service instanceof EventEmitter).should.be.true();
      should.exist(f.service.start);
      should.exist(f.service.close);
      done();
    });

    f.initialize();
  });

  it('removes the FSWatcher when the source is shut down', (done) => {
    f.once('shutdown', () => {
      should(f.service).be.undefined();
      done();
    });

    f.initialize();
    f.shutdown();
  });

  it('updates the source properties from the file', (done) => {
    f.once('update', () => {
      f.properties.should.eql(FILE_CONTENTS.properties);
      done();
    });

    f.initialize();
    should(f.properties).eql(Object.create(null));
  });

  /* eslint-disable max-nested-callbacks */
  it('updates the source properties if the file changes', (done) => {
    f.once('update', () => {
      fs.writeFile(FILE_TO_WATCH, JSON.stringify(UPDATED_PROPS, null, '\t'), (err) => {
        if (err) {
          throw err;
        }
        f.once('update', () => {
          f.properties.should.eql(UPDATED_PROPS.properties);
          done();
        });
      });
    });

    f.initialize();
  });

  after((done) => {
    fs.writeFile(FILE_TO_WATCH, JSON.stringify(FILE_CONTENTS, null, '\t'), (err) => {
      if (err) {
        throw err;
      }
      done();
    });
  });

  /* eslint-enable max-nested-callbacks */
  it('empties the properties object on clear()', (done) => {
    f.once('update', () => {
      should(f.properties).not.be.empty();
      f.clear();
      should(f.properties).be.empty();
      done();
    });

    f.initialize();
    should(f.properties).be.an.Object();
    should(f.properties).be.empty();
  });
});
