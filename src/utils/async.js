/** Resolves after `ms` milliseconds. Used to simulate network latency in mocks. */
export const delay = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Returns a structural clone so callers can never mutate the mock fixtures. */
export const clone = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
