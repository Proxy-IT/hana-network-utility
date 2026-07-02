import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

// Read the version once, at config-load time, from the single source of truth.
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/**
 * Hana — Vite configuration
 *
 * Replaces Create React App. Produces a static bundle in ./build that
 * Electron loads via file:// in production, and serves a dev server on
 * :5173 in development.
 */
export default defineConfig({
  plugins: [
    // Hana's 14 components are .js files containing JSX (not .jsx). Tell the
    // React plugin to process .js as well so nothing needs to be renamed.
    react({
      include: /\.(js|jsx)$/,
    }),
  ],

  // esbuild must also treat .js as JSX during dev-server transforms and
  // dependency pre-bundling — without this, JSX inside .js throws a parse error.
  esbuild: {
    loader:  'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },

  // Single-sources the app version at build time. Components import this as
  // `__APP_VERSION__` instead of hardcoding a string — eliminates the class of
  // bug where one of five version locations gets missed on a release (this
  // has happened twice: v1.7.1→v1.7.2 forgot About.js's DetailRow initially,
  // and a later patch left two files at v1.7.1 after a version bump).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  // CRITICAL for Electron: relative base so the packaged app can load assets
  // from disk via file:// without absolute-path 404s. Without this the
  // packaged app shows a blank window (this bit Hana once already, under CRA).
  base: './',

  server: {
    host:       '127.0.0.1', // force IPv4 loopback — start-electron.js polls 127.0.0.1
    port:       5173,
    strictPort: true,   // fail loudly if 5173 is taken, rather than silently moving
  },

  build: {
    outDir:      'build',   // keep 'build' so electron-builder's file globs stay unchanged
    emptyOutDir: true,
    sourcemap:   false,     // no production source maps — see CSP/hardening notes in main.js
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
