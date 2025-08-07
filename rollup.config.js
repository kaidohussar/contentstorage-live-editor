import typescript from '@rollup/plugin-typescript';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/live-editor.js',
      format: 'es',
    },
  ],
  plugins: [
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
    terser(),
  ],
};
