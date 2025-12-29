import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  return {
    base: './',
    plugins: [react()],
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true
        }
      }
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true
    },
    build: {
      chunkSizeWarningLimit: 1500
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './setupTests.ts',
      coverage: {
        include: ['src/**'],
        exclude: ['src/**/vite-env.d.ts', 'src/**/main.tsx', 'src/**/reportWebVitals.ts', 'src/**/mocks'],
        reporter: ['text', 'json', 'html']
      },
      exclude: [...configDefaults.exclude, 'node_modules'],
      include: ['src/**/__tests__/*.{test,spec}.{js,ts,jsx,tsx}']
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    }
  };
});
