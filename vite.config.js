import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const resolvePath = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(({ mode, command }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
  const target = apiBaseUrl.replace(/\/api\/?$/, '') || 'http://127.0.0.1:8000';
  const wsTarget = target.replace(/^http/, 'ws');

  // Dev server uses VITE_APP_BASE_URL directly. Production builds emit a placeholder that
  // `scripts/set-base.mjs` swaps for the real path, so it can change without a rebuild.
  const base = command === 'build' ? '/__TOSS_BASE__/' : env.VITE_APP_BASE_URL || '/';

  return {
    base,
    plugins: [react(), tailwindcss()],

    resolve: { 
      alias: {
        '@': resolvePath('./src'),
        '@app': resolvePath('./src/app'),
        '@api': resolvePath('./src/api'),
        '@assets': resolvePath('./src/assets'),
        '@components': resolvePath('./src/components'),
        '@config': resolvePath('./src/config'),
        '@constants': resolvePath('./src/constants'),
        '@context': resolvePath('./src/context'),
        '@hooks': resolvePath('./src/hooks'),
        '@layouts': resolvePath('./src/layouts'),
        '@mocks': resolvePath('./src/mocks'),
        '@pages': resolvePath('./src/pages'),
        '@routes': resolvePath('./src/routes'),
        '@services': resolvePath('./src/services'),
        '@styles': resolvePath('./src/styles'),
        '@theme': resolvePath('./src/theme'),
        '@utils': resolvePath('./src/utils'),
      },
    },

    server: {
      port: 3001,
      strictPort: true,
      open: false,
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        },
      },                                           
    },

  build: {
    // Placeholder build; `scripts/set-base.mjs` turns it into the deployable `dist/`.
    outDir: 'dist-template',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
  };
});
