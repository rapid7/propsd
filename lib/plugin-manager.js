/* global Log, Config */
'use strict';

const Metadata = require('./source/metadata');
//const S3 = require('./source/s3');
//const Consul = require('./source/consul');

class PluginManager {
  constructor(storage) {
    this.storage = storage;
    this.index = this._registerIndex();
    this._registerPlugins();
  }

  _registerIndex() {

  }

  _registerPlugins() {
    const instance = new Metadata();

    this._registerPluginEvents(instance);
    this.storage.register(instance);
    instance.initialize();
  }

  _registerPluginEvents(plugin) {
    plugin.on('startup', () => {
      Log.info(`${plugin.name} started up.`);
    });

    plugin.on('shutdown', () => {
      Log.info(`${plugin.name} shut down.`);
    });

    plugin.on('update', () => {
      Log.info(`${plugin.name}'s data was updated from its underlying source data.`);
      this.storage.update();
    });

    plugin.on('no-update', () => {
      Log.info(`${plugin.name} has no update to its underlying source data.`);
    });

    plugin.on('error', (err) => {
      Log.info(`${plugin.name} encountered the following error: ${err}`);
    });
  }
}

function createPluginManager(sourcePath, storage) {
  return new PluginManager(sourcePath, storage);
}

exports.attach = createPluginManager;
