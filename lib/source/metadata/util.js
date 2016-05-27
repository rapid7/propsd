'use strict';

const DEFAULT_PARALLEL = 16;

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
exports.each = function each(list, work, done, s) {
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
