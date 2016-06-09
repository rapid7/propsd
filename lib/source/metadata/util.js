'use strict';
const Path = require('path');

const DEFAULT_PARALLEL = 16;
const METADATA_LIST = /^(\d+)=(.+)$/;

/**
 * Iterate over a list of tasks in parallel, passing one to each call of the
 * `work` function. When all tasks are complete, or an error is encountered, call the
 * `done` function, with an error if one occurred.
 *
 * This implementation iterates over a work-list non-destructively, without cloning it.
 * meaning that more tasks can be added safely while the work-loop is running.
 *
 * @param  {Array}    list    Set of tasks to work on
 * @param  {Function} work    The operation to perform on each element of `list`
 * @param  {Function} done    Callback on error or completion
 * @param  {Object}   s { parallel: Number limit parallel tasks. Default 16 }
 */
function each(list, work, done, s) {
  const state = s || {
    parallel: DEFAULT_PARALLEL,
    error: false
  };

  // Default values
  if (!Number(state.running)) {
    state.running = 0;
  }
  if (!Number(state.cursor)) {
    state.cursor = 0;
  }

  // No more items to process
  if (state.cursor >= list.length) {
    // Call done if this was the last branch
    if (state.running === 0 && !state.error) {
      done();
    }

    return;
  }

  // Already enough tasks in flight
  if (state.running >= state.parallel) {
    return;
  }

  // Get an item off of the list, move up the cursor, and get a semaphore.
  const item = list[state.cursor];

  // Obtain a semaphore
  state.running += 1;
  state.cursor += 1;

  // Branch parallel requests
  while (state.running < state.parallel && state.cursor < list.length) {
    each(list, work, done, state);
  }

  // Process this branch's task
  work(item, (err) => {
    // Release the semaphore
    state.running -= 1;

    // An error has occurred. Just bail.
    if (state.error) {
      return;
    }

    if (err) {
      state.error = true;
      return done(err); // eslint-disable-line consistent-return
    }

    // Iterate
    each(list, work, done, state);
  });
}
exports.each = each;

/**
 * Fetch all values from the EC2 metadata tree
 *
 * @param  {String}   version              The Metadata API version to traverse
 * @param  {Array}    paths                An initial array of paths to traverse
 * @param  {Function} request(path, cb)    Request handler. Called for each Metadata path
 * @param  {Function} callback(err, paths) Return an error or a hash of paths and their values
 */
exports.traverse = function traverse(version, paths, request, callback) {
  const values = {};

  each(paths, (path, next) => {
    request(Path.join('/', version, path), (err, data) => {
      if (err) {
        return next(err);
      }

      // This is a tree! Split new-line delimited strings into an array and add to tail of paths
      if (path.slice(-1) === '/') {
        const items = data.trim().split('\n');

        // Is this a list?
        if (items.reduce((memo, item) => memo && METADATA_LIST.test(item), true)) {
          const list = values[path.slice(1, -1)] = [];

          items.forEach((item) => {
            const match = item.match(METADATA_LIST);

            if (match) {
              list[match[1]] = match[2];
            }
          });

          return next();
        }

        items.forEach((node) => paths.push(Path.join(path, node)));
        return next();
      }

      // Remove leading `/`
      values[path.slice(1)] = data;
      next();
    });
  }, (err) => callback(err, values), null);
};
