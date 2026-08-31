import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const resolvePath = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_APP_START_TIME': JSON.stringify(Date.now().toString()),
  },


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
    port: 3000,
    open: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
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
});
