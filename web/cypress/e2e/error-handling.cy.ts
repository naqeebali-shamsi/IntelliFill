/// <reference types="cypress" />

/**
 * Error Handling & Edge Cases E2E Tests
 * 
 * Tests comprehensive error scenarios and edge cases including:
 * - Network connectivity issues and offline behavior
 * - API failures and timeout handling
 * - Form validation and input sanitization
 * - Authentication and authorization errors
 * - File corruption and invalid data handling
 * - Rate limiting and abuse prevention
 * - Browser compatibility and feature detection
 */

describe('Error Handling & Edge Cases', () => {
  let testUser: any
  let testCompany: any

  before(() => {
    cy.fixture('users').then((users) => {
      testUser = users.testUser
      testCompany = users.companies[0]
    })
  })

  beforeEach(() => {
    cy.clearAuth()
  })

  afterEach(() => {
    cy.clearAuth()
  })

  describe('Network Connectivity Issues', () => {
    it('should handle complete network failure gracefully', () => {
      cy.intercept('**', { forceNetworkError: true }).as('networkFailure')

      cy.visit('/login')

      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)
      cy.get('[data-cy="login-button"]').click()

      cy.get('[data-cy="network-error-banner"]')
        .should('be.visible')
        .should('contain', 'Network connection failed')

      cy.get('[data-cy="retry-connection-button"]')
        .should('be.visible')

      cy.get('[data-cy="offline-mode-indicator"]')
        .should('be.visible')
        .should('contain', 'You appear to be offline')
    })

    it('should queue actions when offline and retry when online', () => {
      cy.loginViaApi(testUser)
      cy.visit('/documents/upload')

      // Upload a document while online
      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      // Simulate going offline
      cy.intercept('POST', '/api/documents/process', { forceNetworkError: true })
        .as('offlineProcessing')

      cy.get('[data-cy="start-processing-button"]').click()

      cy.get('[data-cy="action-queued-notification"]')
        .should('be.visible')
        .should('contain', 'Action queued - will retry when online')

      cy.get('[data-cy="queued-actions-indicator"]')
        .should('be.visible')
        .should('contain', '1 action pending')

      // Simulate coming back online
      cy.intercept('POST', '/api/documents/process', {
        statusCode: 200,
        body: { jobId: 'job_123', status: 'processing' }
      }).as('onlineProcessing')

      cy.get('[data-cy="retry-queued-actions-button"]').click()

      cy.wait('@onlineProcessing')

      cy.get('[data-cy="actions-retried-notification"]')
        .should('be.visible')
        .should('contain', 'Queued actions completed')
    })

    it('should handle slow network connections', () => {
      cy.intercept('POST', '/api/documents/upload', (req) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              statusCode: 200,
              body: { documentId: 'doc_123' }
            })
          }, 10000) // 10 second delay
        })
      }).as('slowUpload')

      cy.loginViaApi(testUser)
      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      // Should show slow connection warning
      cy.get('[data-cy="slow-connection-warning"]', { timeout: 5000 })
        .should('be.visible')
        .should('contain', 'Connection appears slow')

      cy.get('[data-cy="upload-progress-detailed"]')
        .should('be.visible')
        .should('contain', 'Estimated time remaining')

      cy.get('[data-cy="cancel-upload-button"]')
        .should('be.visible')
    })

    it('should handle intermittent connectivity', () => {
      let requestCount = 0
      
      cy.intercept('GET', '/api/user/credits', (req) => {
        requestCount++
        if (requestCount % 2 === 0) {
          return { forceNetworkError: true }
        }
        return {
          statusCode: 200,
          body: { available: 85, total: 100 }
        }
      }).as('intermittentConnection')

      cy.loginViaApi(testUser)
      cy.visit('/dashboard')

      cy.get('[data-cy="connection-unstable-warning"]')
        .should('be.visible')
        .should('contain', 'Connection unstable')

      cy.get('[data-cy="auto-retry-indicator"]')
        .should('be.visible')
        .should('contain', 'Auto-retrying...')

      cy.get('[data-cy="credits-widget"]')
        .should('eventually.be.visible')
    })
  })

  describe('API Failures and Timeout Handling', () => {
    beforeEach(() => {
      cy.loginViaApi(testUser)
    })

    it('should handle 500 internal server errors', () => {
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 500,
        body: { error: 'Internal server error', code: 'SERVER_ERROR' }
      }).as('serverError')

      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.wait('@serverError')

      cy.get('[data-cy="server-error-message"]')
        .should('be.visible')
        .should('contain', 'Server error occurred')

      cy.get('[data-cy="error-code"]')
        .should('be.visible')
        .should('contain', 'Error Code: SERVER_ERROR')

      cy.get('[data-cy="retry-button"]')
        .should('be.visible')

      cy.get('[data-cy="report-error-button"]')
        .should('be.visible')
    })

    it('should handle API rate limiting', () => {
      cy.intercept('POST', '/api/documents/process', {
        statusCode: 429,
        body: { 
          error: 'Rate limit exceeded',
          retryAfter: 60,
          code: 'RATE_LIMIT_EXCEEDED'
        }
      }).as('rateLimited')

      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="start-processing-button"]').click()

      cy.wait('@rateLimited')

      cy.get('[data-cy="rate-limit-error"]')
        .should('be.visible')
        .should('contain', 'Rate limit exceeded')

      cy.get('[data-cy="retry-countdown"]')
        .should('be.visible')
        .should('contain', 'Retry in 60 seconds')

      cy.get('[data-cy="start-processing-button"]')
        .should('be.disabled')
    })

    it('should handle API timeouts', () => {
      cy.intercept('POST', '/api/documents/process', (req) => {
        return new Promise(() => {
          // Never resolve to simulate timeout
        })
      }).as('timeoutRequest')

      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="start-processing-button"]').click()

      cy.get('[data-cy="request-timeout-warning"]', { timeout: 30000 })
        .should('be.visible')
        .should('contain', 'Request is taking longer than expected')

      cy.get('[data-cy="cancel-request-button"]')
        .should('be.visible')

      cy.get('[data-cy="continue-waiting-button"]')
        .should('be.visible')
    })

    it('should handle malformed API responses', () => {
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: 'invalid json response'
      }).as('malformedResponse')

      cy.visit('/dashboard')

      cy.wait('@malformedResponse')

      cy.get('[data-cy="data-parsing-error"]')
        .should('be.visible')
        .should('contain', 'Unable to parse server response')

      cy.get('[data-cy="refresh-page-button"]')
        .should('be.visible')
    })

    it('should handle unexpected API status codes', () => {
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 418, // I'm a teapot
        body: { error: 'Unexpected error' }
      }).as('unexpectedStatus')

      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.wait('@unexpectedStatus')

      cy.get('[data-cy="unexpected-error"]')
        .should('be.visible')
        .should('contain', 'Unexpected error occurred')

      cy.get('[data-cy="error-details"]')
        .should('be.visible')
        .should('contain', 'Status: 418')
    })
  })

  describe('Authentication and Authorization Errors', () => {
    it('should handle expired JWT tokens', () => {
      cy.intercept('GET', '/api/user/profile', {
        statusCode: 401,
        body: { error: 'Token expired', code: 'TOKEN_EXPIRED' }
      }).as('expiredToken')

      cy.loginViaApi(testUser)
      cy.visit('/dashboard')

      // Trigger an API call
      cy.get('[data-cy="refresh-data-button"]').click()

      cy.wait('@expiredToken')

      cy.get('[data-cy="session-expired-modal"]')
        .should('be.visible')
        .should('contain', 'Your session has expired')

      cy.get('[data-cy="login-again-button"]')
        .should('be.visible')
        .click()

      cy.url().should('include', '/login')
    })

    it('should handle insufficient permissions', () => {
      cy.intercept('GET', '/api/admin/settings', {
        statusCode: 403,
        body: { error: 'Insufficient permissions', code: 'FORBIDDEN' }
      }).as('forbiddenAccess')

      cy.fixture('users').then((users) => {
        const regularUser = users.regularUser
        cy.loginViaApi(regularUser)
      })

      cy.visit('/admin/settings')

      cy.wait('@forbiddenAccess')

      cy.get('[data-cy="access-denied-message"]')
        .should('be.visible')
        .should('contain', 'Access denied')

      cy.get('[data-cy="insufficient-permissions"]')
        .should('be.visible')
        .should('contain', 'You do not have permission')

      cy.get('[data-cy="go-back-button"]')
        .should('be.visible')
    })

    it('should handle account suspension', () => {
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 403,
        body: { 
          error: 'Account suspended',
          code: 'ACCOUNT_SUSPENDED',
          reason: 'Terms of service violation'
        }
      }).as('suspendedAccount')

      cy.visit('/login')

      cy.get('[data-cy="email-input"]').type('suspended@example.com')
      cy.get('[data-cy="password-input"]').type('password123')
      cy.get('[data-cy="login-button"]').click()

      cy.wait('@suspendedAccount')

      cy.get('[data-cy="account-suspended-error"]')
        .should('be.visible')
        .should('contain', 'Account suspended')

      cy.get('[data-cy="suspension-reason"]')
        .should('be.visible')
        .should('contain', 'Terms of service violation')

      cy.get('[data-cy="contact-support-button"]')
        .should('be.visible')
    })

    it('should handle invalid refresh tokens', () => {
      cy.intercept('POST', '/api/auth/refresh', {
        statusCode: 401,
        body: { error: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' }
      }).as('invalidRefreshToken')

      cy.loginViaApi(testUser)
      cy.visit('/dashboard')

      // Mock token refresh attempt
      cy.window().then((win) => {
        win.localStorage.setItem('refresh-token', 'invalid_token')
      })

      cy.get('[data-cy="user-menu"]').click()

      cy.wait('@invalidRefreshToken')

      cy.get('[data-cy="authentication-error"]')
        .should('be.visible')
        .should('contain', 'Authentication failed')

      cy.url().should('include', '/login')
    })
  })

  describe('Form Validation and Input Sanitization', () => {
    it('should handle XSS injection attempts', () => {
      cy.visit('/register')

      const xssPayload = '<script>alert("xss")</script>'

      cy.get('[data-cy="name-input"]').type(xssPayload)
      cy.get('[data-cy="email-input"]').type('test@example.com')
      cy.get('[data-cy="password-input"]').type('Password123!')
      cy.get('[data-cy="terms-checkbox"]').check()

      cy.get('[data-cy="register-button"]').click()

      // Should sanitize input and show warning
      cy.get('[data-cy="input-sanitized-warning"]')
        .should('be.visible')
        .should('contain', 'Invalid characters removed')

      cy.get('[data-cy="name-input"]')
        .should('not.contain', '<script>')
    })

    it('should handle SQL injection attempts', () => {
      cy.visit('/login')

      const sqlPayload = "'; DROP TABLE users; --"

      cy.get('[data-cy="email-input"]').type(sqlPayload)
      cy.get('[data-cy="password-input"]').type('password')
      cy.get('[data-cy="login-button"]').click()

      cy.get('[data-cy="invalid-input-error"]')
        .should('be.visible')
        .should('contain', 'Invalid email format')
    })

    it('should handle extremely long input values', () => {
      cy.visit('/documents/upload')

      const longText = 'a'.repeat(10000)

      cy.get('[data-cy="document-description"]').type(longText)

      cy.get('[data-cy="input-too-long-error"]')
        .should('be.visible')
        .should('contain', 'Input exceeds maximum length')

      cy.get('[data-cy="character-count"]')
        .should('be.visible')
        .should('contain', 'Maximum 1000 characters')
    })

    it('should handle Unicode and special characters', () => {
      cy.visit('/team/invite')

      const unicodeText = '测试用户 🚀 émojis ñ'

      cy.get('[data-cy="member-name-input"]').type(unicodeText)
      cy.get('[data-cy="member-email-input"]').type('test@example.com')

      cy.get('[data-cy="send-invitation-button"]').click()

      // Should handle Unicode correctly
      cy.get('[data-cy="name-preview"]')
        .should('contain', unicodeText)
    })

    it('should validate file upload edge cases', () => {
      cy.loginViaApi(testUser)
      cy.visit('/documents/upload')

      // Test empty file
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' })
      cy.get('[data-cy="file-input"]').selectFile(emptyFile, { force: true })

      cy.get('[data-cy="empty-file-error"]')
        .should('be.visible')
        .should('contain', 'File is empty')

      // Test file with null bytes
      const maliciousFile = new File(['\x00\x00\x00'], 'malicious.pdf', { type: 'application/pdf' })
      cy.get('[data-cy="file-input"]').selectFile(maliciousFile, { force: true })

      cy.get('[data-cy="suspicious-file-error"]')
        .should('be.visible')
        .should('contain', 'File contains suspicious content')
    })
  })

  describe('File Corruption and Invalid Data', () => {
    beforeEach(() => {
      cy.loginViaApi(testUser)
      cy.visit('/documents/upload')
    })

    it('should handle corrupted PDF files', () => {
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 400,
        body: { 
          error: 'Corrupted file detected',
          code: 'FILE_CORRUPTED',
          details: 'PDF header invalid'
        }
      }).as('corruptedFile')

      cy.fixture('corrupted.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'corrupted.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.wait('@corruptedFile')

      cy.get('[data-cy="file-corruption-error"]')
        .should('be.visible')
        .should('contain', 'File appears to be corrupted')

      cy.get('[data-cy="corruption-details"]')
        .should('be.visible')
        .should('contain', 'PDF header invalid')

      cy.get('[data-cy="try-different-file-button"]')
        .should('be.visible')
    })

    it('should handle password-protected files', () => {
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 422,
        body: { 
          error: 'Password protected file',
          code: 'PASSWORD_PROTECTED'
        }
      }).as('passwordProtected')

      cy.fixture('protected.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'protected.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.wait('@passwordProtected')

      cy.get('[data-cy="password-protected-modal"]')
        .should('be.visible')
        .should('contain', 'Password Required')

      cy.get('[data-cy="file-password-input"]')
        .should('be.visible')

      cy.get('[data-cy="unlock-file-button"]')
        .should('be.visible')

      cy.get('[data-cy="skip-file-button"]')
        .should('be.visible')
    })

    it('should handle files with invalid MIME types', () => {
      // Upload executable file with PDF extension
      const executableFile = new File(['MZ\x90\x00'], 'virus.pdf', { type: 'application/pdf' })
      
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 415,
        body: { 
          error: 'Invalid file type',
          code: 'MIME_TYPE_MISMATCH',
          detected: 'application/x-executable',
          expected: 'application/pdf'
        }
      }).as('mimeTypeMismatch')

      cy.get('[data-cy="file-input"]').selectFile(executableFile, { force: true })

      cy.wait('@mimeTypeMismatch')

      cy.get('[data-cy="mime-type-error"]')
        .should('be.visible')
        .should('contain', 'File type mismatch')

      cy.get('[data-cy="security-warning"]')
        .should('be.visible')
        .should('contain', 'Security check failed')
    })

    it('should handle malformed document content', () => {
      cy.intercept('POST', '/api/documents/process', {
        statusCode: 422,
        body: { 
          error: 'Unable to parse document content',
          code: 'MALFORMED_CONTENT'
        }
      }).as('malformedContent')

      cy.fixture('malformed.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'malformed.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="start-processing-button"]').click()

      cy.wait('@malformedContent')

      cy.get('[data-cy="content-parsing-error"]')
        .should('be.visible')
        .should('contain', 'Unable to parse document')

      cy.get('[data-cy="manual-processing-option"]')
        .should('be.visible')
        .should('contain', 'Try manual processing')
    })
  })

  describe('Browser Compatibility and Feature Detection', () => {
    it('should detect missing browser features', () => {
      cy.window().then((win) => {
        // Mock missing File API
        delete win.File
      })

      cy.visit('/documents/upload')

      cy.get('[data-cy="browser-incompatible-warning"]')
        .should('be.visible')
        .should('contain', 'Browser not supported')

      cy.get('[data-cy="missing-features-list"]')
        .should('be.visible')
        .should('contain', 'File API')

      cy.get('[data-cy="upgrade-browser-button"]')
        .should('be.visible')
    })

    it('should handle localStorage unavailability', () => {
      cy.window().then((win) => {
        // Mock localStorage failure
        Object.defineProperty(win, 'localStorage', {
          value: {
            setItem: () => { throw new Error('localStorage disabled') },
            getItem: () => null,
            removeItem: () => {},
            clear: () => {}
          }
        })
      })

      cy.visit('/login')

      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)
      cy.get('[data-cy="login-button"]').click()

      cy.get('[data-cy="storage-warning"]')
        .should('be.visible')
        .should('contain', 'Local storage unavailable')

      cy.get('[data-cy="session-only-mode"]')
        .should('be.visible')
        .should('contain', 'Session-only mode active')
    })

    it('should detect slow JavaScript execution', () => {
      cy.window().then((win) => {
        // Mock slow performance
        const originalRequestAnimationFrame = win.requestAnimationFrame
        win.requestAnimationFrame = (callback) => {
          setTimeout(callback, 100) // Slow down animations
        }
      })

      cy.visit('/dashboard')

      cy.get('[data-cy="performance-warning"]')
        .should('be.visible')
        .should('contain', 'Slow performance detected')

      cy.get('[data-cy="reduce-animations-button"]')
        .should('be.visible')
    })

    it('should handle memory limitations', () => {
      cy.visit('/documents/upload')

      // Try to upload a very large file
      const largeArrayBuffer = new ArrayBuffer(100 * 1024 * 1024) // 100MB
      const largeFile = new File([largeArrayBuffer], 'huge.pdf', { type: 'application/pdf' })

      cy.get('[data-cy="file-input"]').selectFile(largeFile, { force: true })

      cy.get('[data-cy="memory-warning"]')
        .should('be.visible')
        .should('contain', 'Large file detected')

      cy.get('[data-cy="memory-usage-indicator"]')
        .should('be.visible')

      cy.get('[data-cy="reduce-quality-option"]')
        .should('be.visible')
    })
  })

  describe('Error Recovery and Fallbacks', () => {
    it('should implement graceful degradation', () => {
      // Mock WebAssembly not available
      cy.window().then((win) => {
        delete win.WebAssembly
      })

      cy.loginViaApi(testUser)
      cy.visit('/documents/upload')

      cy.get('[data-cy="fallback-mode-warning"]')
        .should('be.visible')
        .should('contain', 'Using fallback processing')

      cy.get('[data-cy="performance-impact-notice"]')
        .should('be.visible')
        .should('contain', 'Processing may be slower')
    })

    it('should provide manual retry mechanisms', () => {
      cy.intercept('POST', '/api/documents/process', {
        statusCode: 500,
        body: { error: 'Processing failed' }
      }).as('processingFailed')

      cy.loginViaApi(testUser)
      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="start-processing-button"]').click()

      cy.wait('@processingFailed')

      cy.get('[data-cy="processing-failed-error"]')
        .should('be.visible')

      cy.get('[data-cy="retry-options"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="retry-immediately"]').should('be.visible')
          cy.get('[data-cy="retry-with-different-settings"]').should('be.visible')
          cy.get('[data-cy="manual-processing"]').should('be.visible')
        })
    })

    it('should save user progress during errors', () => {
      cy.loginViaApi(testUser)
      cy.visit('/documents/doc_123/review')

      // Fill some form data
      cy.get('[data-cy="field-name"]').type('John Doe')
      cy.get('[data-cy="field-email"]').type('john@example.com')

      // Simulate network error during save
      cy.intercept('PUT', '/api/documents/doc_123/fields', { forceNetworkError: true })
        .as('saveError')

      cy.get('[data-cy="save-changes-button"]').click()

      cy.get('[data-cy="auto-save-failed-warning"]')
        .should('be.visible')
        .should('contain', 'Auto-save failed')

      cy.get('[data-cy="draft-saved-locally"]')
        .should('be.visible')
        .should('contain', 'Draft saved locally')

      // Verify data is preserved
      cy.reload()

      cy.get('[data-cy="restore-draft-notification"]')
        .should('be.visible')
        .should('contain', 'Unsaved changes found')

      cy.get('[data-cy="restore-draft-button"]').click()

      cy.get('[data-cy="field-name"]').should('have.value', 'John Doe')
      cy.get('[data-cy="field-email"]').should('have.value', 'john@example.com')
    })

    it('should implement circuit breaker pattern', () => {
      let requestCount = 0

      cy.intercept('POST', '/api/documents/process', (req) => {
        requestCount++
        if (requestCount <= 5) {
          return { statusCode: 500, body: { error: 'Server error' } }
        }
        return { statusCode: 503, body: { error: 'Circuit breaker open' } }
      }).as('circuitBreaker')

      cy.loginViaApi(testUser)
      cy.visit('/documents/upload')

      // Attempt multiple requests to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        cy.fixture('sample.pdf', 'base64').then(fileContent => {
          cy.get('[data-cy="file-input"]').selectFile({
            contents: Cypress.Buffer.from(fileContent, 'base64'),
            fileName: 'sample.pdf',
            mimeType: 'application/pdf'
          }, { force: true })
        })

        cy.get('[data-cy="start-processing-button"]').click()
        cy.get('[data-cy="retry-button"]').click()
      }

      cy.get('[data-cy="circuit-breaker-notice"]')
        .should('be.visible')
        .should('contain', 'Service temporarily unavailable')

      cy.get('[data-cy="cooldown-timer"]')
        .should('be.visible')
    })
  })
})