import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  testMatch: '**/backend.spec.ts',
  fullyParallel: false,
  workers: 1,
});
