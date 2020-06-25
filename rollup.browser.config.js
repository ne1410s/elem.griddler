import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';
import url from '@rollup/plugin-url';
import pkg from './package.json';

// UMD build (for browsers)
export default {
  input: 'src/index.ts',
  output: {
    name: pkg.displayName,
    file: pkg.browser,
    format: 'umd',
    globals: {
      '@ne1410s/cust-elems': 'ne_cust_elems',
      '@ne1410s/dom': 'ne_dom',
      '@ne1410s/menu': 'ne_menu',
      '@ne1410s/popup': 'ne_pop',
      '@ne1410s/pxl8r': 'ne_pxl8r',
    },
  },
  plugins: [
    resolve(), // find external modules
    commonjs(), // convert external modules to ES modules
    typescript(),
    json(),
    url({ include: ['src/**/*.css', 'src/**/*.html'] }),
  ],
};
