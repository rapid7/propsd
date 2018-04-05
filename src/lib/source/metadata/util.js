'use strict';
const Path = require('path');

const DEFAULT_PARALLEL = 1;

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
 * @return {Object}                        The results of the traversal
 */
exports.traverse = function traverse(version, paths, request) {
  const values = {};

  let error;

  while (paths.length > 0) {
    const path = paths.shift();
    const joinedPath = Path.join('/', version, path);

    request(joinedPath, (err, data) => {
      if (err) {
        error = err;

        return;
      }

      if (typeof data === 'undefined') {
        return;
      }

      // This is a tree! Split new-line delimited strings into an array and add to paths
      if (path.slice(-1) === '/') {
        // Remove leading `/`
        const items = data.trim().split('\n');

        items.forEach((node) => paths.push(Path.join(path, node)));

        return;
      }

      values[path] = data;
    });
  }

  return {error, values};
};
