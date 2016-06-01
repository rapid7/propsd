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
const chokidar = require('chokidar');
const nconf = require('nconf');

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

nconf.set('log:level', 'debug');
const Log = require('../../lib/logger').attach('debug');

const awsConfig = {
  s3ForcePathStyle: true,
  endpoint: new AWS.Endpoint(`http://${hostname}:${port}`)
};
const awsClient = new AWS.S3(awsConfig);

function getBucketName(p) {
  return `propsd-${Path.basename(p)}`;
}

/**
 * Removes the "bucket" created in the temp folder
 */
function cleanupTempDir() {
  const tmpDirBucketPath = Path.resolve(os.tmpdir(), `propsd-temp-s3-server`);

  try {
    rmdir.sync(tmpDirBucketPath);
  } catch (err) {
    throw err;
  }
}

/**
 * Creates a directory for the "bucket" in the temp folder
 * @returns {String}
 */
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

/**
 * Copies files from the watched folder the the "bucket"
 * @param {String} bucket
 */
function copyFiles(bucket) {
  const walker = walk.walk(path);

  walker.on('file', (root, fileStats, next) => {
    const pathToFile = Path.join(Path.relative(path, root), fileStats.name);
    const stream = fs.createReadStream(Path.join(path, pathToFile));

    awsClient.putObject({
      Bucket: bucket,
      Key: pathToFile,
      Body: stream
    }, (err) => {
      if (err) {
        Log.ERROR(err, err.stack);
      }
      next();
    });
  });
}

/**
 * Deletes the contents of the "bucket"
 * @param {String} bucket
 */
function emptyBucket(bucket) {
  awsClient.listObjects({Bucket: bucket}, (listErr, listData) => {
    if (listErr) {
      throw listErr;
    }
    listData.Contents.forEach((el) => {
      awsClient.deleteObject({Bucket: bucket, Key: el.Key}, (deleteErr) => {
        if (deleteErr) {
          throw deleteErr;
        }
      });
    });
  });
}

/**
 * Handles cleanup on app exit
 * @param {Error} err
 */
function exitHandler(err) {
  let code = 0;

  if (err) {
    Log.ERROR(err, err.stack);
    code = 1;
  }
  const tmpDirBucketPath = Path.resolve(os.tmpdir(), `propsd-temp-s3-server`);

  Log.INFO(`Cleaning up temp directory: ${tmpDirBucketPath}`);
  cleanupTempDir();
  process.exit(code);
}

function onFileChange(bucket) {
  emptyBucket(bucket);
  copyFiles(bucket);
}

function createBucket(bucket) {
  awsClient.createBucket({Bucket: bucket}, (createBucketErr) => {
    if (createBucketErr) {
      throw createBucketErr;
    }
    copyFiles(bucket);

    // Watch for both change and unlink events.
    chokidar.watch(path, {persistent: true}).on('change', () => onFileChange(bucket));
    chokidar.watch(path, {persistent: true}).on('unlink', () => onFileChange(bucket));
  });
}

function init() {
  fs.stat(path, (err, stats) => {
    if (err) {
      Log.ERROR(err, err.stack);
      process.exit(1);
    }
    if (!stats.isDirectory()) {
      Log.ERROR(`${path} is not a directory`);
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
        Log.ERROR(serverErr, serverErr.stack);
        process.exit(1);
      }

      createBucket(bucket);

      Log.INFO(`listening for S3 requests at http://${host}:${p}`);
    });
  });
}

init();

// do something when app is closing
process.on('exit', exitHandler);

// catches ctrl+c event
process.on('SIGINT', exitHandler);

// catches uncaught exceptions
process.on('uncaughtException', (err) => {
  exitHandler(err);
});
