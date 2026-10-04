import { defineConfig, type Options } from 'tsup';

/**
 * Shared tsup config for every extension. Each extension's tsup.config.ts is:
 *
 *   import { createExtensionConfig } from '../tsup.preset';
 *   export default createExtensionConfig('my-extension');
 *
 * Output is a single-file IIFE at `dist/<name>.js` (committed to git so
 * jsDelivr keeps serving `@main/<name>/dist/<name>.js`).
 *
 * Prod (`NODE_ENV=production`) minifies and drops console/debugger.
 * Dev keeps readable output and console logging.
 *
 * For React-using extensions, pass externals so Spotify's own React is used
 * instead of bundling a copy:
 *   createExtensionConfig('foo', {
 *     external: ['react', 'react-dom'],
 *     esbuildOptions(o) { o.inject = ['./react-shim.ts']; },
 *   });
 */
export function createExtensionConfig(name: string, overrides: Partial<Options> = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const debugBuild = process.env.SPICETIFY_EXTENSIONS_DEBUG === 'true';
  const keepDebug = !isProd || debugBuild;
  return defineConfig({
    entry: { [name]: `src/${name}.ts` },
    outDir: 'dist',
    format: ['iife'],
    platform: 'browser',
    target: 'es2020',
    treeshake: true,
    splitting: false,
    sourcemap: false,
    clean: false,
    dts: false,
    minify: isProd && !debugBuild,
    outExtension() {
      return { js: '.js' };
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
      __SPICETIFY_EXTENSIONS_DEBUG__: JSON.stringify(keepDebug),
    },
    esbuildOptions(options) {
      options.legalComments = 'none';
      options.drop = keepDebug ? [] : ['console', 'debugger'];
    },
    ...overrides,
  });
}
