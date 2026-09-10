const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/browser',
  use: { viewport: { width: 390, height: 844 } },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
})
