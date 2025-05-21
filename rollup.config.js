import typescript from '@rollup/plugin-typescript';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/bundle.es5.mjs',
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
            targets: {
              browsers:
                '> 0.5%, last 2 versions, Firefox ESR, not dead, ie >= 11',
            },
          },
        ],
      ],
    }),
    terser(),
  ],
};
