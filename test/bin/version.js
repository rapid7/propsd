#!/usr/bin/env node

'use strict';

let version;

try {
  version = require('../../package').version;
} catch (ex) {
  version = '0.0.0';
}

const path = require('path');
const fs = require('fs');

fs.writeFileSync(path.resolve('src/version.json'), JSON.stringify({version}));
