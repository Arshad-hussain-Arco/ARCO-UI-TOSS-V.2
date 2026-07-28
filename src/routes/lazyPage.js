import { lazy } from 'react';

/**
 * Wraps a dynamic import for use as a route element.
 *
 * Pages are authored with named exports for testability; this normalises them to
 * the default export React.lazy requires, so no page has to carry a redundant
 * `export default` purely for routing.
 *
 * @param {() => Promise<Record<string, unknown>>} importer
 * @param {string} [exportName]  Named export to use; defaults to the module default.
 */
export const lazyPage = (importer, exportName) =>
  lazy(async () => {
    const module = await importer();
    return { default: exportName ? module[exportName] : module.default };
  });

export default lazyPage;
