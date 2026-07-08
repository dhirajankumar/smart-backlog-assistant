const { composePlugins, withNx } = require('@nx/webpack');

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx({
    target: 'node',
  }),
  (config) => {
    // Force-bundle @modelcontextprotocol/sdk so pkg can include it in the standalone exe.
    // Nx externalizes all node_modules by default; we need to override that for this ESM package.
    const original = config.externals;
    config.externals = [
      (ctx, callback) => {
        // Bundle MCP SDK and zod together so pkg can include them in the standalone exe.
        // pkg doesn't handle package.json `exports` subpaths (zod/v3, zod/v4-mini), so
        // we must let webpack resolve those at build time rather than at pkg runtime.
        if (
          ctx.request &&
          (ctx.request.startsWith('@modelcontextprotocol/') ||
            ctx.request === 'zod' ||
            ctx.request.startsWith('zod/') ||
            ctx.request === 'zod-to-json-schema')
        ) {
          return callback();
        }
        if (typeof original === 'function') {
          return original(ctx, callback);
        }
        if (Array.isArray(original)) {
          for (const ext of original) {
            if (typeof ext === 'function') return ext(ctx, callback);
          }
        }
        return callback();
      },
    ];
    return config;
  }
);
