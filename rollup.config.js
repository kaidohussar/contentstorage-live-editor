import typescript from '@rollup/plugin-typescript';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(join(__dirname, 'package.json'), 'utf8')
);
const version = packageJson.version;

// Shared plugins configuration
const getPlugins = () => [
  resolve({
    browser: true,
  }),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
  }),
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
    presets: [
      [
        '@babel/preset-env',
        {
          targets: 'last 2 years',
        },
      ],
    ],
  }),
];

// Live Editor bundle (existing)
const liveEditorConfig = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/live-editor.js',
      format: 'es',
      banner: `// Contentstorage Live Editor v${version} - Built ${new Date().toISOString()}`,
    },
  ],
  plugins: [
    ...getPlugins(),
    terser({
      format: {
        comments: (node, comment) => {
          return (
            comment.type === 'comment2' &&
            /Contentstorage Live Editor/.test(comment.value)
          );
        },
        preamble: `// Contentstorage Live Editor v${version} - Built ${new Date().toISOString()}`,
      },
    }),
  ],
};

// Browser Script bundle (new, IIFE format, optimized for size)
const browserScriptConfig = {
  input: 'src/browser-script/index.ts',
  output: [
    {
      file: 'dist/browser-script.js',
      format: 'iife',
      banner: `// Contentstorage Browser Script v${version} - Built ${new Date().toISOString()}`,
    },
  ],
  plugins: [
    ...getPlugins(),
    terser({
      compress: {
        passes: 2,
        pure_getters: true,
      },
      format: {
        comments: (node, comment) => {
          return (
            comment.type === 'comment2' &&
            /Contentstorage Browser Script/.test(comment.value)
          );
        },
        preamble: `// Contentstorage Browser Script v${version} - Built ${new Date().toISOString()}`,
      },
    }),
  ],
};

// Loader Snippet - tiny inline script for user's <head> tag
// Outputs minified IIFE that conditionally loads browser-script.js
const loaderSnippetConfig = {
  input: 'src/loader-snippet.ts',
  output: [
    {
      file: 'dist/loader-snippet.js',
      format: 'iife',
    },
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
    }),
    terser({
      compress: {
        passes: 3,
        pure_getters: true,
        toplevel: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    }),
  ],
};

export default [liveEditorConfig, browserScriptConfig, loaderSnippetConfig];
