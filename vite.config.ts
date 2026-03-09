import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isNodeModule = (id: string, packageName: string) =>
    id.includes(`/node_modules/${packageName}/`) || id.includes(`\\node_modules\\${packageName}\\`);

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }

            if (
              isNodeModule(id, 'react') ||
              isNodeModule(id, 'react-dom') ||
              isNodeModule(id, 'react-router-dom')
            ) {
              return 'vendor';
            }

            if (isNodeModule(id, '@tanstack/react-query')) {
              return 'react-query';
            }

            if (isNodeModule(id, 'axios')) {
              return 'http';
            }

            if (
              isNodeModule(id, 'react-hook-form') ||
              isNodeModule(id, '@hookform/resolvers') ||
              isNodeModule(id, 'zod')
            ) {
              return 'forms';
            }

            if (id.includes('motion')) {
              return 'motion';
            }

            if (isNodeModule(id, 'lucide-react')) {
              return 'icons';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
