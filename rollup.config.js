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

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/live-editor.js',
      format: 'es',
      banner: `// Contentstorage Live Editor v${version} - Built ${new Date().toISOString()}`,
    },
  ],
  plugins: [
    resolve({
      browser: true, // Use browser-friendly modules
    }),
    commonjs(), // Convert CommonJS modules to ES6
    typescript({
      tsconfig: './tsconfig.json', // Explicitly specify tsconfig
    }),
    babel({
      babelHelpers: 'bundled', // Bundles Babel helpers, avoids external dependencies
      exclude: 'node_modules/**', // Don't transpile external libraries
      presets: [
        [
          '@babel/preset-env',
          {
            targets: 'last 2 years',
          },
        ],
      ],
    }),
    terser({
      format: {
        comments: (node, comment) => {
          // Preserve comments that contain "Contentstorage Live Editor"
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
