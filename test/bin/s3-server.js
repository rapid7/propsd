#!/usr/bin/env node

/* global Config, Log */
'use strict';
const fs = require('fs');
const S3rver = require('s3rver');
const os = require('os');
const Path = require('path');
const AWS = require('aws-sdk');
const rmdir = require('rimraf');
const walk = require('walk');

const DEFAULT_HTTP_PORT = 4569;

const args = require('yargs')
  .usage('Usage: $0 [args]')
  .option('d', {
    alias: 'data',
    describe: 'Load data directory from filesystem',
    type: 'string',
    required: true
  })
  .option('h', {
    alias: 'hostname',
    describe: 'The hostname or ip for the server',
    default: '127.0.0.1',
    type: 'string'
  })
  .option('p', {
    alias: 'port',
    describe: 'The port number of the http server',
    default: DEFAULT_HTTP_PORT,
    type: 'number'
  })
  .help('help')
  .argv;

const hostname = args.h;
const port = args.p;
const path = Path.resolve(__dirname, `../../${args.d}`);

const awsConfig = {
  s3ForcePathStyle: true,
  accessKeyId: 'ACCESS_KEY_ID',
  secretAccessKey: 'SECRET_ACCESS_KEY',
  endpoint: new AWS.Endpoint(`http://${hostname}:${port}`)
};
const awsClient = new AWS.S3(awsConfig);

function getBucketName(p) {
  return `propsd-${Path.basename(p)}`;
}

function cleanupTempDir() {
  const tmpDirBucketPath = Path.resolve(os.tmpdir(), `propsd-temp-s3-server`);

  try {
    rmdir.sync(tmpDirBucketPath);
  } catch (err) {
    throw err;
  }
}

function createTempDirForBucket() {
  const tmpDirBucketPath = Path.resolve(os.tmpdir(), `propsd-temp-s3-server`);

  try {
    cleanupTempDir();
    fs.mkdirSync(tmpDirBucketPath);
  } catch (err) {
    throw err;
  }
  return tmpDirBucketPath;
}

/* eslint-disable max-nested-callbacks */
fs.stat(path, (err, stats) => {
  if (err || !stats.isDirectory()) {
    process.exit(1);
  }
  const bucket = getBucketName(path);
  const tmpDir = createTempDirForBucket();

  const client = new S3rver({
    port,
    hostname,
    silent: false,
    directory: tmpDir
  });

  client.run((serverErr, host, p) => {
    if (serverErr) {
      process.exit(1);
    }

    awsClient.createBucket({Bucket: bucket}, (createBucketErr) => {
      if (createBucketErr) {
        throw createBucketErr;
      }

      const walker = walk.walk(path);

      walker.on('file', (root, fileStats, next) => {
        awsClient.putObject({Bucket: bucket, Key: `${Path.relative(path, root)}/${fileStats.name}`}, (putObjectErr) => {
          if (putObjectErr) {
            console.log(err, err.stack); // eslint-disable-line no-console
          }
          next();
        });
      });
    });

    console.log(`listening for S3 requests at http://${host}:${p}`); // eslint-disable-line no-console
  });
});

/* eslint-enable max-nested-callbacks */

function exitHandler() {
  console.log('Cleaning up temp directory'); // eslint-disable-line no-console
  cleanupTempDir();
  process.exit(0);
}

// do something when app is closing
process.on('exit', exitHandler);

// catches ctrl+c event
process.on('SIGINT', exitHandler);

// catches uncaught exceptions
process.on('uncaughtException', exitHandler);
