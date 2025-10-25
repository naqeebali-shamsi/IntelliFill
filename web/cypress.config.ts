import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5174',
    viewportWidth: 1280,
    viewportHeight: 720,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    env: {
      apiUrl: 'http://localhost:3002',
      // Test user credentials
      testUserEmail: 'test@company.com',
      testUserPassword: 'Test123!',
      testCompanyName: 'Test Company'
    },
    setupNodeEvents(on, config) {
      // Node event listeners
      on('task', {
        log(message) {
          console.log(message)
          return null
        }
      })
    }
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite'
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}'
  }
});
