// These values are replaced at build time by esbuild/tsup `define`.
// Declared here so tsc typechecks without pulling in full @types/node.
declare const process: {
  env: {
    NODE_ENV?: string;
    SPICETIFY_EXTENSIONS_DEBUG?: string;
  };
};
declare const __SPICETIFY_EXTENSIONS_DEBUG__: boolean;
