/// <reference types="cypress" />

// Custom commands for QuikAdmin authentication and multi-tenant flows

interface LoginOptions {
  email?: string
  password?: string
  company?: string
}

interface ApiLoginOptions {
  email?: string
  password?: string
  company?: string
}

interface MockApiOptions {
  endpoint: string
  method?: string
  response: any
  statusCode?: number
  delay?: number
}

interface DocumentUploadOptions {
  fileName: string
  fileType?: string
  fileSize?: number
  corrupted?: boolean
}

// Login via UI
Cypress.Commands.add('login', (options: LoginOptions = {}) => {
  const email = options.email || Cypress.env('testUserEmail')
  const password = options.password || Cypress.env('testUserPassword')
  const company = options.company || Cypress.env('testCompanyName')

  cy.visit('/login')
  
  // Fill login form
  cy.get('[data-cy="email-input"]').type(email)
  cy.get('[data-cy="password-input"]').type(password)
  
  // Handle company selection if multi-tenant
  if (company) {
    cy.get('[data-cy="company-input"]').type(company)
  }
  
  cy.get('[data-cy="login-button"]').click()
  
  // Wait for successful login and redirect
  cy.url().should('not.include', '/login')
  cy.window().its('localStorage').should('have.property', 'auth-token')
})

// Login via API (faster for setup)
Cypress.Commands.add('loginViaApi', (options: ApiLoginOptions = {}) => {
  const email = options.email || Cypress.env('testUserEmail')
  const password = options.password || Cypress.env('testUserPassword')
  const company = options.company || Cypress.env('testCompanyName')

  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/auth/login`,
    body: {
      email,
      password,
      company
    }
  }).then((response) => {
    expect(response.status).to.eq(200)
    expect(response.body).to.have.property('token')
    
    // Store token in localStorage
    window.localStorage.setItem('auth-token', response.body.token)
    
    // Store user data if needed
    if (response.body.user) {
      window.localStorage.setItem('user-data', JSON.stringify(response.body.user))
    }
  })
})

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-cy="user-menu"]').click()
  cy.get('[data-cy="logout-button"]').click()
  cy.url().should('include', '/login')
  cy.window().its('localStorage').should('not.have.property', 'auth-token')
})

// Clear auth state
Cypress.Commands.add('clearAuth', () => {
  cy.window().then((window) => {
    window.localStorage.removeItem('auth-token')
    window.localStorage.removeItem('user-data')
    window.localStorage.removeItem('company-data')
  })
})

// Check if user is authenticated
Cypress.Commands.add('checkAuthState', (shouldBeAuthenticated: boolean = true) => {
  if (shouldBeAuthenticated) {
    cy.window().its('localStorage').should('have.property', 'auth-token')
  } else {
    cy.window().its('localStorage').should('not.have.property', 'auth-token')
  }
})

// Upload document helper
Cypress.Commands.add('uploadDocument', (fileName: string) => {
  cy.get('[data-cy="file-upload"]').selectFile(fileName, { force: true })
  cy.get('[data-cy="upload-button"]').click()
})

// Wait for API calls to complete
Cypress.Commands.add('waitForApi', (alias: string) => {
  cy.wait(alias)
  cy.get('[data-cy="loading-spinner"]').should('not.exist')
})

// Check responsive design
Cypress.Commands.add('checkResponsive', () => {
  // Desktop
  cy.viewport(1280, 720)
  cy.wait(500)
  
  // Tablet
  cy.viewport(768, 1024)
  cy.wait(500)
  
  // Mobile
  cy.viewport(375, 667)
  cy.wait(500)
  
  // Reset to desktop
  cy.viewport(1280, 720)
})

// Enhanced document upload with comprehensive options
Cypress.Commands.add('uploadDocumentAdvanced', (options: DocumentUploadOptions) => {
  const { fileName, fileType = 'application/pdf', fileSize = 1024576, corrupted = false } = options

  if (corrupted) {
    // Create corrupted file content
    const corruptedContent = 'corrupted file content'
    cy.get('[data-cy="file-input"]').selectFile({
      contents: corruptedContent,
      fileName,
      mimeType: fileType
    }, { force: true })
  } else {
    cy.fixture(fileName, 'base64').then(fileContent => {
      cy.get('[data-cy="file-input"]').selectFile({
        contents: Cypress.Buffer.from(fileContent, 'base64'),
        fileName,
        mimeType: fileType
      }, { force: true })
    })
  }
})

// Mock API responses with enhanced functionality
Cypress.Commands.add('mockApi', (options: MockApiOptions) => {
  const { endpoint, method = 'GET', response, statusCode = 200, delay = 0 } = options
  
  const interceptOptions: any = {
    statusCode,
    body: response
  }

  if (delay > 0) {
    interceptOptions.delay = delay
  }

  cy.intercept(method, endpoint, interceptOptions).as(endpoint.replace(/[^a-zA-Z0-9]/g, ''))
})

// Setup common API mocks for testing
Cypress.Commands.add('setupApiMocks', () => {
  cy.fixture('api-responses').then((responses) => {
    // Auth mocks
    cy.intercept('POST', '/api/auth/login', responses.auth.loginSuccess).as('loginSuccess')
    cy.intercept('POST', '/api/auth/refresh', responses.auth.loginSuccess).as('refreshToken')
    
    // Document mocks
    cy.intercept('POST', '/api/documents/upload', responses.documents.uploadSuccess).as('uploadDocument')
    cy.intercept('POST', '/api/documents/*/process', responses.documents.processSuccess).as('processDocument')
    
    // Credits mocks
    cy.intercept('GET', '/api/user/credits', responses.credits.balance).as('getCredits')
    
    // Team mocks
    cy.intercept('GET', '/api/team/members', responses.team.membersList).as('getTeamMembers')
  })
})

// Create test company with random data
Cypress.Commands.add('createTestCompany', (template: string = 'startup') => {
  cy.fixture('companies').then((companies) => {
    const companyTemplate = companies.newCompanyTemplates[template]
    const randomId = Math.random().toString(36).substring(2, 8)
    
    const testCompany = {
      name: companyTemplate.name.replace('{{randomName}}', `Test${randomId}`),
      slug: companyTemplate.slug.replace('{{randomSlug}}', `test-${randomId}`),
      domain: companyTemplate.domain.replace('{{randomDomain}}', `test${randomId}`),
      industry: companyTemplate.industry,
      size: companyTemplate.size
    }

    cy.wrap(testCompany).as('testCompany')
    return cy.wrap(testCompany)
  })
})

// Create test user with role
Cypress.Commands.add('createTestUser', (role: string = 'user', companySlug?: string) => {
  const randomId = Math.random().toString(36).substring(2, 8)
  
  const testUser = {
    name: `Test User ${randomId}`,
    email: `test${randomId}@example.com`,
    password: 'TestPassword123!',
    role,
    company: companySlug
  }

  cy.wrap(testUser).as('testUser')
  return cy.wrap(testUser)
})

// Simulate document processing workflow
Cypress.Commands.add('processDocumentWorkflow', (fileName: string) => {
  cy.uploadDocumentAdvanced({ fileName })
  
  cy.get('[data-cy="start-processing-button"]').click()
  
  // Mock processing status updates
  cy.intercept('GET', '/api/jobs/*/status', { 
    statusCode: 200, 
    body: { status: 'processing', progress: 50 } 
  }).as('processingStatus')
  
  cy.wait('@processingStatus')
  
  // Complete processing
  cy.intercept('GET', '/api/jobs/*/status', {
    statusCode: 200,
    body: { status: 'completed', result: { extractedFields: {} } }
  }).as('processingComplete')
  
  cy.wait('@processingComplete')
  
  cy.get('[data-cy="processing-complete"]').should('be.visible')
})

// Setup credit scenarios (low, sufficient, insufficient)
Cypress.Commands.add('setupCreditScenario', (scenario: 'low' | 'sufficient' | 'insufficient') => {
  cy.fixture('api-responses').then((responses) => {
    let creditResponse
    
    switch (scenario) {
      case 'low':
        creditResponse = responses.credits.lowBalance
        break
      case 'insufficient':
        creditResponse = responses.credits.insufficientCredits
        break
      default:
        creditResponse = responses.credits.balance
    }
    
    cy.intercept('GET', '/api/user/credits', creditResponse).as('getCredits')
  })
})

// Simulate network conditions
Cypress.Commands.add('simulateNetworkCondition', (condition: 'slow' | 'offline' | 'unstable') => {
  switch (condition) {
    case 'slow':
      cy.intercept('**', (req) => {
        req.reply((res) => {
          res.delay(3000) // 3 second delay
        })
      }).as('slowNetwork')
      break
    case 'offline':
      cy.intercept('**', { forceNetworkError: true }).as('offlineNetwork')
      break
    case 'unstable':
      let requestCount = 0
      cy.intercept('**', (req) => {
        requestCount++
        if (requestCount % 3 === 0) {
          req.reply({ forceNetworkError: true })
        } else {
          req.continue()
        }
      }).as('unstableNetwork')
      break
  }
})

// Check accessibility compliance
Cypress.Commands.add('checkAccessibility', (options = {}) => {
  cy.injectAxe()
  cy.checkA11y(undefined, {
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true },
      ...options
    }
  })
})

// Test mobile viewport and interactions
Cypress.Commands.add('testMobileViewport', (viewport: string = 'iphone-6') => {
  cy.viewport(viewport as Cypress.ViewportPreset)
  
  // Verify mobile-specific elements
  cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible')
  cy.get('[data-cy="desktop-navigation"]').should('not.be.visible')
  
  // Test touch interactions
  cy.get('[data-cy="mobile-menu-toggle"]')
    .trigger('touchstart')
    .trigger('touchend')
})

// Performance monitoring
Cypress.Commands.add('measurePerformance', (actionName: string) => {
  cy.window().then((win) => {
    const startTime = performance.now()
    
    cy.wrap(actionName).as('currentAction')
    
    cy.then(() => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      cy.log(`Performance: ${actionName} took ${duration.toFixed(2)}ms`)
      
      // Assert performance is within acceptable limits
      expect(duration).to.be.lessThan(5000) // 5 second max
    })
  })
})

// Security testing helpers
Cypress.Commands.add('testXSSPrevention', (inputSelector: string) => {
  cy.fixture('test-scenarios').then((scenarios) => {
    scenarios.securityTestData.xssPayloads.forEach((payload: string) => {
      cy.get(inputSelector).clear().type(payload)
      
      // Verify payload is sanitized
      cy.get(inputSelector).should('not.contain', '<script>')
      cy.get(inputSelector).should('not.contain', 'javascript:')
    })
  })
})

// Advanced form testing
Cypress.Commands.add('fillFormFromFixture', (formSelector: string, fixtureData: any) => {
  Object.keys(fixtureData).forEach((field) => {
    const value = fixtureData[field]
    const fieldSelector = `${formSelector} [data-cy="${field}-input"]`
    
    cy.get(fieldSelector).then(($element) => {
      const elementType = $element.prop('type') || $element.prop('tagName').toLowerCase()
      
      switch (elementType) {
        case 'checkbox':
          if (value) cy.get(fieldSelector).check()
          break
        case 'select':
          cy.get(fieldSelector).select(value)
          break
        case 'file':
          cy.get(fieldSelector).selectFile(value, { force: true })
          break
        default:
          cy.get(fieldSelector).type(value)
      }
    })
  })
})

// Wait for all API calls to complete
Cypress.Commands.add('waitForAllApiCalls', () => {
  cy.get('[data-cy="loading-spinner"]').should('not.exist')
  cy.get('[data-cy="api-loading"]').should('not.exist')
  
  // Wait for any pending requests
  cy.wait(500)
})

declare global {
  namespace Cypress {
    interface Chainable {
      login(options?: LoginOptions): Chainable<void>
      loginViaApi(options?: ApiLoginOptions): Chainable<void>
      logout(): Chainable<void>
      clearAuth(): Chainable<void>
      checkAuthState(shouldBeAuthenticated?: boolean): Chainable<void>
      uploadDocument(fileName: string): Chainable<void>
      waitForApi(alias: string): Chainable<void>
      checkResponsive(): Chainable<void>
      
      // Enhanced commands
      uploadDocumentAdvanced(options: DocumentUploadOptions): Chainable<void>
      mockApi(options: MockApiOptions): Chainable<void>
      setupApiMocks(): Chainable<void>
      createTestCompany(template?: string): Chainable<any>
      createTestUser(role?: string, companySlug?: string): Chainable<any>
      processDocumentWorkflow(fileName: string): Chainable<void>
      setupCreditScenario(scenario: 'low' | 'sufficient' | 'insufficient'): Chainable<void>
      simulateNetworkCondition(condition: 'slow' | 'offline' | 'unstable'): Chainable<void>
      checkAccessibility(options?: any): Chainable<void>
      testMobileViewport(viewport?: string): Chainable<void>
      measurePerformance(actionName: string): Chainable<void>
      testXSSPrevention(inputSelector: string): Chainable<void>
      fillFormFromFixture(formSelector: string, fixtureData: any): Chainable<void>
      waitForAllApiCalls(): Chainable<void>
    }
  }
}