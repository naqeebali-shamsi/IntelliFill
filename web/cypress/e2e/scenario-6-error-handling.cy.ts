/// <reference types="cypress" />

/**
 * Scenario 6: Error Handling & Edge Cases
 * Tests system resilience, error recovery, and edge case handling
 */

describe('Scenario 6: Error Handling & Edge Cases', () => {
  beforeEach(() => {
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
  })

  describe('Network Errors', () => {
    it('should handle complete network failure', () => {
      cy.visit('/login')
      
      // Simulate network failure
      cy.intercept('**/*', { forceNetworkError: true }).as('networkError')
      
      // Try to login
      cy.get('#companySlug').type('test-company')
      cy.get('#email').type('user@example.com')
      cy.get('#password').type('password123')
      cy.contains('button', 'Sign in').click()
      
      // Should show network error
      cy.contains(/network|connection|offline/i).should('be.visible')
    })

    it('should handle API timeout', () => {
      cy.visit('/login')
      
      // Simulate timeout (no response)
      cy.intercept('POST', '**/api/auth/login', (req) => {
        // Never respond
      }).as('timeout')
      
      // Try to login
      cy.get('#companySlug').type('test-company')
      cy.get('#email').type('user@example.com')
      cy.get('#password').type('password123')
      cy.contains('button', 'Sign in').click()
      
      // Should show timeout error after default timeout
      cy.contains(/timeout|taking too long/i, { timeout: 15000 }).should('be.visible')
    })

    it('should retry failed requests', () => {
      let attemptCount = 0
      
      cy.visit('/dashboard')
      
      // Fail first 2 attempts, succeed on 3rd
      cy.intercept('GET', '**/api/documents/history', (req) => {
        attemptCount++
        if (attemptCount < 3) {
          req.reply({ statusCode: 500, body: { error: 'Server error' } })
        } else {
          req.reply({ statusCode: 200, body: { documents: [] } })
        }
      }).as('retryRequest')
      
      // Should retry and eventually succeed
      cy.wait('@retryRequest')
      cy.wait('@retryRequest')
      cy.wait('@retryRequest')
      
      // Should not show error after successful retry
      cy.contains(/error/i).should('not.exist')
    })

    it('should handle intermittent network issues', () => {
      let requestCount = 0
      
      cy.visit('/upload')
      
      // Simulate intermittent failures (every other request fails)
      cy.intercept('**', (req) => {
        requestCount++
        if (requestCount % 2 === 0) {
          req.reply({ forceNetworkError: true })
        } else {
          req.continue()
        }
      }).as('intermittent')
      
      // System should handle intermittent issues
      cy.contains('Upload Document').should('be.visible')
    })
  })

  describe('Authentication Errors', () => {
    it('should handle expired token', () => {
      // Set expired token
      cy.window().then((win) => {
        win.localStorage.setItem('intellifill-auth', JSON.stringify({
          state: {
            user: { id: 'user-123' },
            tokens: {
              accessToken: 'expired-token',
              expiresAt: Date.now() - 10000 // Expired
            },
            isAuthenticated: true
          }
        }))
      })
      
      cy.visit('/dashboard')
      
      // Should redirect to login
      cy.url().should('include', '/login')
      cy.contains(/session.*expired/i).should('be.visible')
    })

    it('should handle invalid token', () => {
      // Set invalid token
      cy.window().then((win) => {
        win.localStorage.setItem('intellifill-auth', JSON.stringify({
          state: {
            user: { id: 'user-123' },
            tokens: {
              accessToken: 'invalid-token',
              expiresAt: Date.now() + 3600000
            },
            isAuthenticated: true
          }
        }))
      })
      
      // Mock 401 response
      cy.intercept('GET', '**', {
        statusCode: 401,
        body: { error: 'Invalid token' }
      }).as('invalidToken')
      
      cy.visit('/dashboard')
      
      // Should redirect to login
      cy.url().should('include', '/login')
    })

    it('should handle concurrent login attempts', () => {
      cy.visit('/login')
      
      // Mock login endpoint
      cy.intercept('POST', '**/api/auth/login', {
        delay: 1000,
        statusCode: 200,
        body: { success: true }
      }).as('login')
      
      // Fill form
      cy.get('#companySlug').type('test-company')
      cy.get('#email').type('user@example.com')
      cy.get('#password').type('password123')
      
      // Click login button multiple times quickly
      const button = cy.contains('button', 'Sign in')
      button.click()
      button.click()
      button.click()
      
      // Should only send one request
      cy.get('@login.all').should('have.length', 1)
    })

    it('should handle account lockout after failed attempts', () => {
      cy.visit('/login')
      
      let attemptCount = 0
      
      // Mock failed login attempts
      cy.intercept('POST', '**/api/auth/login', (req) => {
        attemptCount++
        if (attemptCount < 5) {
          req.reply({
            statusCode: 401,
            body: { error: 'Invalid credentials', attemptsRemaining: 5 - attemptCount }
          })
        } else {
          req.reply({
            statusCode: 423,
            body: { error: 'Account locked', lockDuration: 900 }
          })
        }
      }).as('loginAttempt')
      
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        cy.get('#email').clear().type('user@example.com')
        cy.get('#password').clear().type('wrongpassword')
        cy.contains('button', 'Sign in').click()
        cy.wait('@loginAttempt')
      }
      
      // Should show lockout message
      cy.contains(/account.*locked/i).should('be.visible')
      cy.contains(/15 minutes/i).should('be.visible')
    })
  })

  describe('Data Validation Errors', () => {
    it('should handle malformed API responses', () => {
      cy.visit('/dashboard')
      
      // Mock malformed response
      cy.intercept('GET', '**/api/user/profile', {
        statusCode: 200,
        body: 'This is not JSON'
      }).as('malformedResponse')
      
      cy.wait('@malformedResponse')
      
      // Should handle gracefully
      cy.contains(/error|problem/i).should('be.visible')
    })

    it('should handle missing required fields', () => {
      cy.visit('/dashboard')
      
      // Mock response with missing fields
      cy.intercept('GET', '**/api/user/profile', {
        statusCode: 200,
        body: {
          // Missing required fields like id, email
          name: 'John Doe'
        }
      }).as('incompleteData')
      
      cy.wait('@incompleteData')
      
      // Should handle missing data
      cy.contains(/error|incomplete/i).should('be.visible')
    })

    it('should validate form inputs client-side', () => {
      cy.visit('/register')
      
      // Try invalid email
      cy.get('input[type="email"]').type('not-an-email')
      cy.get('input[type="email"]').blur()
      cy.contains(/invalid.*email/i).should('be.visible')
      
      // Try weak password
      cy.get('input[type="password"]').type('123')
      cy.get('input[type="password"]').blur()
      cy.contains(/password.*weak|short/i).should('be.visible')
      
      // Try mismatched passwords
      cy.get('input[name="password"]').type('ValidPass123!')
      cy.get('input[name="confirmPassword"]').type('DifferentPass123!')
      cy.get('input[name="confirmPassword"]').blur()
      cy.contains(/password.*match/i).should('be.visible')
    })

    it('should sanitize user inputs', () => {
      cy.visit('/profile')
      
      // Try XSS in input
      cy.get('input[name="name"]').type('<script>alert("XSS")</script>')
      cy.contains('button', /save/i).click()
      
      // Script should not execute
      cy.on('window:alert', () => {
        throw new Error('XSS vulnerability detected!')
      })
      
      // Should sanitize the input
      cy.get('input[name="name"]').should('not.contain', '<script>')
    })
  })

  describe('File Upload Errors', () => {
    it('should handle corrupted file upload', () => {
      cy.visit('/upload')
      
      // Create corrupted file
      const corruptedContent = '\x00\x01\x02\xFF\xFE\xFD'
      
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from(corruptedContent),
        fileName: 'corrupted.pdf',
        mimeType: 'application/pdf'
      }, { force: true })
      
      // Mock error response
      cy.intercept('POST', '**/api/documents/upload', {
        statusCode: 422,
        body: { error: 'File appears to be corrupted' }
      }).as('corruptedUpload')
      
      cy.wait('@corruptedUpload')
      
      // Should show error
      cy.contains(/corrupted|invalid file/i).should('be.visible')
    })

    it('should handle file size limit', () => {
      cy.visit('/upload')
      
      // Create large file (11MB)
      const largeContent = 'x'.repeat(11 * 1024 * 1024)
      
      // Should reject before upload
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from(largeContent),
        fileName: 'large.pdf',
        mimeType: 'application/pdf'
      }, { force: true })
      
      // Should show size error immediately
      cy.contains(/too large|exceeds.*limit|10MB/i).should('be.visible')
    })

    it('should handle unsupported file types', () => {
      cy.visit('/upload')
      
      // Try executable file
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('MZ\x90\x00'), // EXE header
        fileName: 'malware.exe',
        mimeType: 'application/x-msdownload'
      }, { force: true })
      
      // Should reject immediately
      cy.contains(/unsupported|not allowed/i).should('be.visible')
    })

    it('should handle upload interruption', () => {
      cy.visit('/upload')
      
      // Mock slow upload that will be interrupted
      cy.intercept('POST', '**/api/documents/upload', (req) => {
        req.destroy() // Simulate connection drop
      }).as('interruptedUpload')
      
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'document.pdf',
        mimeType: 'application/pdf'
      }, { force: true })
      
      // Should show upload error
      cy.contains(/upload.*failed|interrupted/i).should('be.visible')
      
      // Should offer retry
      cy.contains('button', /retry/i).should('be.visible')
    })
  })

  describe('Processing Errors', () => {
    it('should handle OCR failure', () => {
      cy.visit('/documents/doc-123/process')
      
      // Mock OCR failure
      cy.intercept('POST', '**/api/documents/*/process', {
        statusCode: 500,
        body: { error: 'OCR processing failed: Unable to extract text' }
      }).as('ocrFailure')
      
      cy.contains('button', /process/i).click()
      cy.wait('@ocrFailure')
      
      // Should show error with options
      cy.contains(/OCR.*failed/i).should('be.visible')
      cy.contains('button', /retry/i).should('be.visible')
      cy.contains('button', /manual.*entry/i).should('be.visible')
    })

    it('should handle partial processing failure', () => {
      cy.visit('/documents/batch/process')
      
      // Mock partial failure
      cy.intercept('POST', '**/api/documents/batch/process', {
        statusCode: 207, // Multi-status
        body: {
          processed: 3,
          failed: 2,
          results: [
            { id: 'doc-1', status: 'success' },
            { id: 'doc-2', status: 'success' },
            { id: 'doc-3', status: 'failed', error: 'Corrupted file' },
            { id: 'doc-4', status: 'success' },
            { id: 'doc-5', status: 'failed', error: 'OCR failed' }
          ]
        }
      }).as('partialFailure')
      
      cy.wait('@partialFailure')
      
      // Should show partial success
      cy.contains('3 of 5 documents processed').should('be.visible')
      cy.contains('2 failed').should('be.visible')
      
      // Should list failed documents
      cy.contains('doc-3').should('be.visible')
      cy.contains('doc-5').should('be.visible')
    })
  })

  describe('Concurrent Access Issues', () => {
    it('should handle concurrent document edits', () => {
      cy.visit('/documents/doc-123/edit')
      
      // Simulate another user editing
      cy.intercept('PUT', '**/api/documents/doc-123', {
        statusCode: 409,
        body: {
          error: 'Document was modified by another user',
          modifiedBy: 'Jane Doe',
          modifiedAt: new Date().toISOString()
        }
      }).as('conflictEdit')
      
      // Try to save
      cy.get('input[name="field1"]').type('New value')
      cy.contains('button', /save/i).click()
      cy.wait('@conflictEdit')
      
      // Should show conflict message
      cy.contains(/modified.*another user/i).should('be.visible')
      cy.contains('Jane Doe').should('be.visible')
      
      // Should offer options
      cy.contains('button', /reload/i).should('be.visible')
      cy.contains('button', /overwrite/i).should('be.visible')
    })

    it('should handle race conditions in credit deduction', () => {
      // Simulate rapid document processing
      cy.visit('/upload')
      
      // Mock credit check
      cy.intercept('POST', '**/api/credits/deduct', {
        statusCode: 402,
        body: {
          error: 'Insufficient credits after concurrent deductions',
          currentBalance: 5,
          required: 10
        }
      }).as('creditRace')
      
      // Upload multiple files quickly
      for (let i = 0; i < 3; i++) {
        cy.get('input[type="file"]').selectFile({
          contents: Cypress.Buffer.from(`PDF ${i}`),
          fileName: `doc${i}.pdf`,
          mimeType: 'application/pdf'
        }, { force: true })
      }
      
      // Process all at once
      cy.contains('button', /process all/i).click()
      cy.wait('@creditRace')
      
      // Should handle gracefully
      cy.contains(/insufficient credits/i).should('be.visible')
      cy.contains('5 credits remaining').should('be.visible')
    })
  })

  describe('Browser Compatibility', () => {
    it('should handle localStorage unavailable', () => {
      // Disable localStorage
      cy.window().then((win) => {
        cy.stub(win.Storage.prototype, 'setItem').throws(new Error('localStorage disabled'))
      })
      
      cy.visit('/login')
      
      // Should show warning
      cy.contains(/storage.*disabled|cookies.*required/i).should('be.visible')
    })

    it('should handle old browser features', () => {
      cy.visit('/')
      
      // Check for feature detection
      cy.window().then((win) => {
        // Simulate missing features
        delete win.IntersectionObserver
        delete win.ResizeObserver
        
        // Reload
        cy.reload()
        
        // Should still work with fallbacks
        cy.contains('QuikAdmin').should('be.visible')
      })
    })
  })

  describe('Security Edge Cases', () => {
    it('should prevent SQL injection attempts', () => {
      cy.visit('/search')
      
      // Try SQL injection
      cy.get('input[type="search"]').type("'; DROP TABLE users; --")
      
      // Mock safe response (properly escaped)
      cy.intercept('GET', '**/api/search*', {
        statusCode: 200,
        body: { results: [], query: "\\'; DROP TABLE users; --" }
      }).as('safeSearch')
      
      cy.get('form').submit()
      cy.wait('@safeSearch')
      
      // Should handle safely
      cy.contains('No results').should('be.visible')
      // No error should occur
      cy.contains(/error/i).should('not.exist')
    })

    it('should prevent path traversal', () => {
      // Try to access parent directories
      cy.request({
        url: '/api/documents/../../etc/passwd',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 403, 404])
      })
    })

    it('should handle CSRF token mismatch', () => {
      cy.visit('/profile')
      
      // Mock CSRF error
      cy.intercept('PUT', '**/api/profile', {
        statusCode: 403,
        body: { error: 'CSRF token mismatch' }
      }).as('csrfError')
      
      cy.get('input[name="name"]').type('New Name')
      cy.contains('button', /save/i).click()
      cy.wait('@csrfError')
      
      // Should refresh token and retry
      cy.contains(/security.*refresh/i).should('be.visible')
    })
  })

  describe('Performance Edge Cases', () => {
    it('should handle large data sets', () => {
      cy.visit('/history')
      
      // Mock large dataset
      const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc-${i}`,
        fileName: `document-${i}.pdf`,
        processedAt: new Date(Date.now() - i * 3600000).toISOString()
      }))
      
      cy.intercept('GET', '**/api/documents/history', {
        statusCode: 200,
        body: { documents: largeHistory, totalCount: 1000 }
      }).as('largeData')
      
      cy.wait('@largeData')
      
      // Should paginate or virtualize
      cy.contains(/showing.*1.*50.*1000/i).should('be.visible')
      // OR
      cy.get('.virtual-scroll').should('exist')
    })

    it('should handle rapid user actions', () => {
      cy.visit('/dashboard')
      
      // Rapidly click different navigation items
      cy.contains('Upload').click()
      cy.contains('History').click()
      cy.contains('Team').click()
      cy.contains('Billing').click()
      cy.contains('Dashboard').click()
      
      // Should handle rapid navigation
      cy.url().should('include', '/dashboard')
      cy.contains('Dashboard').should('be.visible')
    })
  })

  describe('Recovery Mechanisms', () => {
    it('should auto-save form data', () => {
      cy.visit('/documents/new')
      
      // Fill form
      cy.get('input[name="title"]').type('Important Document')
      cy.get('textarea[name="description"]').type('This is a test description')
      
      // Simulate page crash/refresh
      cy.reload()
      
      // Form should be restored
      cy.get('input[name="title"]').should('have.value', 'Important Document')
      cy.get('textarea[name="description"]').should('have.value', 'This is a test description')
    })

    it('should recover from failed saves', () => {
      cy.visit('/documents/doc-123/edit')
      
      let attemptCount = 0
      
      // Fail first save, succeed on retry
      cy.intercept('PUT', '**/api/documents/doc-123', (req) => {
        attemptCount++
        if (attemptCount === 1) {
          req.reply({ statusCode: 500, body: { error: 'Server error' } })
        } else {
          req.reply({ statusCode: 200, body: { success: true } })
        }
      }).as('saveAttempt')
      
      cy.get('input[name="field1"]').type('New value')
      cy.contains('button', /save/i).click()
      
      cy.wait('@saveAttempt') // First attempt fails
      
      // Should show error with retry
      cy.contains(/failed.*retry/i).should('be.visible')
      
      // Click retry
      cy.contains('button', /retry/i).click()
      cy.wait('@saveAttempt') // Second attempt succeeds
      
      // Should show success
      cy.contains(/saved/i).should('be.visible')
    })
  })
})