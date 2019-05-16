'use strict';

require('./lib/helpers');

const expect = require('chai').expect;
const sinon = require('sinon');
const AWS = require('aws-sdk-mock');

const Metadata = require('../dist/lib/source/metadata');
const Parser = require('../dist/lib/source/metadata/parser');
const Util = require('../dist/lib/source/metadata/util');

describe('Metadata source plugin', function _() {
  const metadataPaths = require('./data/metadata-paths.json');
  const metadataValues = require('./data/metadata-values.json');

  it('traverses metadata paths', function __(done) {
    Util.traverse('latest', Parser.paths,
      (path, cb) => cb(null, metadataPaths[path]),
      (err, data) => {
        if (err) {
          return done(err);
        }

        expect(data).to.eql(metadataValues);
        done();
      }
    );
  });

  it('parses traversed values into a useful object', function __() {
    const parser = new Parser();

    parser.update(metadataValues);

    // Currently used in our Index object.
    expect(parser.properties.account).to.be.a('string');
    expect(parser.properties.region).to.be.a('string');
    expect(parser.properties['iam-role']).to.eq('fake-fake');
    expect(parser.properties['vpc-id']).to.be.a('string');
    expect(parser.properties['instance-id']).to.be.a('string');

    expect(parser.properties.identity).to.be.an('object');
    expect(parser.properties.credentials).to.be.an('object');
    expect(parser.properties.interface).to.be.an('object');
  });

  it('doesn\'t display values that are undefined', function () {
    const parser = new Parser();
    const deletedMetadataValues = Object.assign({}, metadataValues);

    deletedMetadataValues['meta-data/instance-id'] = undefined;
    deletedMetadataValues['dynamic/instance-identity/document'] = undefined;

    parser.update(deletedMetadataValues);
    expect(parser.properties).to.not.have.property('instance-id');
    expect(parser.properties.identity).to.not.have.property('document');
    expect(parser.properties).to.not.have.property('account');
    expect(parser.properties).to.not.have.property('region');
  });

  it('handles errors from the AWS SDK gracefully by not exposing the property', function (done) {
    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(new Error('some error from the AWS SDK'), null);
    });

    const source = new Metadata({
      interval: 100
    });

    source.once('update', () => {
      expect(source.properties).to.be.a('object');
      expect(source.properties).to.be.empty;

      AWS.restore();
      done();
    });
    source.initialize();
  });

  it('periodically fetches metadata from the EC2 metadata API', function __(done) {
    this.timeout(2500);

    // Stub the AWS.MetadataService request method
    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(null, metadataPaths[path]);
    });
    AWS.mock('AutoScaling', 'describeAutoScalingInstances', (params, callback) => {
      callback(null, { AutoScalingInstances: [] });
    });

    const source = new Metadata({
      interval: 100
    });

    source.once('update', () => {
      // Currently used in our Index object.
      // console.log('first');
      expect(source.properties.account).to.be.a('string');
      expect(source.properties.region).to.be.a('string');
      expect(source.properties['vpc-id']).to.be.a('string');
      expect(source.properties['iam-role']).to.eq('fake-fake');
      expect(source.properties['instance-id']).to.be.a('string');

      expect(source.properties.identity).to.be.an('object');
      expect(source.properties.credentials).to.be.an('object');
      expect(source.properties.interface).to.be.an('object');

      source.once('noupdate', () => {
        expect(source.state).to.equal(Metadata.RUNNING);
        source.shutdown();

        AWS.restore();
        done();
      });
      // source.shutdown();
      // done();
    });

    // source.once('noupdate', () => {
    //   // console.log('in here?');
    //   expect(source.state).to.equal(Metadata.RUNNING);
    //   source.shutdown();

    //   AWS.restore();
    //   done();
    // });

    source.initialize();
  });

  it('retrieves ASG info for the instance', function (done) {
    this.timeout(2500);

    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(null, metadataPaths[path]);
    });
    AWS.mock('AutoScaling', 'describeAutoScalingInstances', (params, callback) => {
      callback(null, {
        AutoScalingInstances: [{
          AutoScalingGroupName: 'my-cool-auto-scaling-group'
        }]
      });
    });

    const source = new Metadata({
      interval: 100
    });

    source.once('update', () => {
      // Currently used in our Index object.
      expect(source.properties['auto-scaling-group']).to.be.a('string');
      expect(source.properties['auto-scaling-group']).to.equal('my-cool-auto-scaling-group');
      source.shutdown();
      AWS.restore();
      done();
    });

    source.initialize();
  });

  it('only retrieves ASG data once', function (done) {
    const asgSpy = sinon.spy();

    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(null, metadataPaths[path]);
    });
    AWS.mock('AutoScaling', 'describeAutoScalingInstances', (params, callback) => {
      asgSpy();
      callback(null, {
        AutoScalingInstances: [{
          AutoScalingGroupName: 'my-cool-auto-scaling-group'
        }]
      });
    });

    const source = new Metadata({
      interval: 100
    });

    source.once('update', () => {
      expect(asgSpy.calledOnce).to.be.true;
    });

    source.once('noupdate', () => {
      expect(asgSpy.calledOnce).to.be.true;
      source.shutdown();
      AWS.restore();
      done();
    });

    source.initialize();
  });

  it('handles ASG errors from the AWS SDK by not surfacing the auto-scaling-group property', function (done) {
    this.timeout(2500);

    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(null, metadataPaths[path]);
    });
    AWS.mock('AutoScaling', 'describeAutoScalingInstances', (params, callback) => {
      callback(new Error('some error from the AWS SDK'), null);
    });

    const source = new Metadata({
      interval: 100
    });

    source.once('update', () => {
      expect(source.properties['auto-scaling-group']).to.be.undefined;

      AWS.restore();
      done();
    });

    source.initialize();
  });
});

describe("testing", function() {
  it('periodically fetches metadata from the EC2 metadata API', function __(done) {
    this.timeout(2500);

    // Stub the AWS.MetadataService request method
    AWS.mock('MetadataService', 'request', (path, callback) => {
      callback(null, metadataPaths[path]);
    });
    AWS.mock('AutoScaling', 'describeAutoScalingInstances', (params, callback) => {
      callback(null, { AutoScalingInstances: [] });
    });

    const source = new Metadata({
      interval: 100
    });

    source.once('update', () => {
      // Currently used in our Index object.
      // console.log('first');
      expect(source.properties.account).to.be.a('string');
      expect(source.properties.region).to.be.a('string');
      expect(source.properties['vpc-id']).to.be.a('string');
      expect(source.properties['iam-role']).to.eq('fake-fake');
      expect(source.properties['instance-id']).to.be.a('string');

      expect(source.properties.identity).to.be.an('object');
      expect(source.properties.credentials).to.be.an('object');
      expect(source.properties.interface).to.be.an('object');

      source.once('noupdate', () => {
        expect(source.state).to.equal(Metadata.RUNNING);
        source.shutdown();

        AWS.restore();
        done();
      });
      // source.shutdown();
      // done();
    });

    // source.once('noupdate', () => {
    //   // console.log('in here?');
    //   expect(source.state).to.equal(Metadata.RUNNING);
    //   source.shutdown();

    //   AWS.restore();
    //   done();
    // });

    source.initialize();
  });


});
