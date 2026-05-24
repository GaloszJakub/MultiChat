import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Exclude Playwright E2E tests and build outputs from Vitest unit test runner
    exclude: [
      'node_modules/**',
      'dist/**',
      'out/**',
      'e2e/**',
      '**/*.config.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'out/**',
        'dist/**',
        'node_modules/**',
        'e2e/**',
        '**/*.config.ts',
        '**/*.config.js',
        'src/preload/**',
        'src/main/anti-detection.js',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts'
      ]
    }
  }
})
