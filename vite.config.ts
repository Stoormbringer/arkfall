/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: true },
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/sim/**/*.test.ts'],
    // headless-симуляция: собранный Phaser вместо исходников (в исходниках необязательная зависимость для WebGL-дебага)
    alias: { phaser: 'phaser/dist/phaser.js' },
  },
});
