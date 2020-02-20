import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import url from '@rollup/plugin-url';
import pkg from './package.json';

// UMD build (for browsers)
export default {
  input: 'src/index.ts',
  output: {
    name: 'ne_grid',
    file: pkg.browser,
    format: 'umd',
    globals: {
      '@ne1410s/dom': 'ne_dom',
      '@ne1410s/cust-elems': 'ne_cust_elems'
    }
  },
  plugins: [
    resolve(), // find external modules
    commonjs(), // convert external modules to ES modules
    typescript(),
    terser({ include: '*.umd.min.js' }),
    url({ include: ['src/**/*.css', 'src/**/*.html'] })
  ]
};