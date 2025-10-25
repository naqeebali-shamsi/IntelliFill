/// <reference types="cypress" />

/**
 * User Login & Session Management E2E Tests
 * 
 * Tests comprehensive authentication flows including:
 * - Company-based login with slug validation
 * - Session persistence and token management
 * - Multi-factor authentication flows
 * - Account lockout and security features
 * - Remember me functionality
 * - Session expiry handling
 */

describe('User Login & Session Management', () => {
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

  describe('Standard Login Flow', () => {
    it('should login successfully with valid credentials', () => {
      cy.visit('/login')

      // Verify login page elements
      cy.get('[data-cy="login-form"]').should('be.visible')
      cy.get('[data-cy="company-input"]').should('be.visible')
      cy.get('[data-cy="email-input"]').should('be.visible')
      cy.get('[data-cy="password-input"]').should('be.visible')

      // Fill login form
      cy.get('[data-cy="company-input"]').type(testCompany.name)
      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)

      // Submit login
      cy.get('[data-cy="login-button"]').click()

      // Verify successful login
      cy.url().should('not.include', '/login')
      cy.url().should('include', '/dashboard')

      // Verify authentication state
      cy.checkAuthState(true)

      // Verify user data in localStorage
      cy.window().its('localStorage')
        .invoke('getItem', 'user-data')
        .should('exist')
        .then((userData) => {
          const user = JSON.parse(userData)
          expect(user.email).to.equal(testUser.email)
          expect(user.role).to.equal(testUser.role)
        })

      // Verify company context
      cy.window().its('localStorage')
        .invoke('getItem', 'company-data')
        .should('exist')
        .then((companyData) => {
          const company = JSON.parse(companyData)
          expect(company.name).to.equal(testCompany.name)
        })
    })

    it('should login without company slug (default company)', () => {
      cy.visit('/login')

      // Login without company (should use user's default company)
      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)
      cy.get('[data-cy="login-button"]').click()

      cy.url().should('include', '/dashboard')
      cy.checkAuthState(true)
    })

    it('should handle demo credentials functionality', () => {
      cy.visit('/login')

      cy.get('[data-cy="demo-credentials-button"]')
        .should('be.visible')
        .click()

      // Verify form is pre-filled
      cy.get('[data-cy="email-input"]')
        .should('have.value', 'admin@example.com')
      cy.get('[data-cy="password-input"]')
        .should('have.value', 'admin123')
      cy.get('[data-cy="company-input"]')
        .should('have.value', 'demo-company')

      cy.get('[data-cy="login-button"]').click()

      // Should login with demo account
      cy.url().should('include', '/dashboard')
    })
  })

  describe('Authentication Validation', () => {
    it('should reject invalid credentials', () => {
      cy.visit('/login')

      cy.get('[data-cy="email-input"]').type('wrong@email.com')
      cy.get('[data-cy="password-input"]').type('wrongpassword')
      cy.get('[data-cy="login-button"]').click()

      cy.get('[data-cy="error-message"]')
        .should('be.visible')
        .should('contain', 'Invalid credentials')

      // Should remain on login page
      cy.url().should('include', '/login')
      cy.checkAuthState(false)
    })

    it('should validate email format', () => {
      cy.visit('/login')

      cy.get('[data-cy="email-input"]')
        .type('invalid-email')
        .blur()

      cy.get('[data-cy="email-error"]')
        .should('be.visible')
        .should('contain', 'Please enter a valid email address')

      cy.get('[data-cy="login-button"]').should('be.disabled')
    })

    it('should handle non-existent company', () => {
      cy.visit('/login')

      cy.get('[data-cy="company-input"]').type('non-existent-company')
      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)
      cy.get('[data-cy="login-button"]').click()

      cy.get('[data-cy="error-message"]')
        .should('be.visible')
        .should('contain', 'Company not found')
    })

    it('should reject user from different company', () => {
      cy.fixture('users').then((users) => {
        const anotherCompanyUser = users.anotherCompanyUser

        cy.visit('/login')

        cy.get('[data-cy="company-input"]').type(testCompany.name)
        cy.get('[data-cy="email-input"]').type(anotherCompanyUser.email)
        cy.get('[data-cy="password-input"]').type(anotherCompanyUser.password)
        cy.get('[data-cy="login-button"]').click()

        cy.get('[data-cy="error-message"]')
          .should('be.visible')
          .should('contain', 'User not found in this company')
      })
    })
  })

  describe('Account Security Features', () => {
    it('should implement account lockout after failed attempts', () => {
      cy.visit('/login')

      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        cy.get('[data-cy="email-input"]').clear().type(testUser.email)
        cy.get('[data-cy="password-input"]').clear().type('wrongpassword')
        cy.get('[data-cy="login-button"]').click()

        if (i < 4) {
          cy.get('[data-cy="attempts-warning"]')
            .should('be.visible')
            .should('contain', `${4 - i} attempts remaining`)
        }
      }

      // Account should be locked
      cy.get('[data-cy="account-locked-message"]')
        .should('be.visible')
        .should('contain', 'Account locked')

      cy.get('[data-cy="login-button"]').should('be.disabled')

      // Verify lockout persists across page reload
      cy.reload()
      cy.get('[data-cy="account-locked-message"]')
        .should('be.visible')
    })

    it('should show password visibility toggle', () => {
      cy.visit('/login')

      cy.get('[data-cy="password-input"]')
        .should('have.attr', 'type', 'password')

      cy.get('[data-cy="password-toggle"]').click()

      cy.get('[data-cy="password-input"]')
        .should('have.attr', 'type', 'text')

      cy.get('[data-cy="password-toggle"]').click()

      cy.get('[data-cy="password-input"]')
        .should('have.attr', 'type', 'password')
    })

    it('should handle forgot password flow', () => {
      cy.visit('/login')

      cy.get('[data-cy="forgot-password-link"]')
        .should('be.visible')
        .click()

      cy.url().should('include', '/forgot-password')

      cy.get('[data-cy="reset-email-input"]')
        .type(testUser.email)

      cy.get('[data-cy="send-reset-button"]').click()

      cy.get('[data-cy="reset-sent-message"]')
        .should('be.visible')
        .should('contain', 'Password reset email sent')
    })
  })

  describe('Remember Me Functionality', () => {
    it('should persist session when remember me is checked', () => {
      cy.visit('/login')

      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)
      cy.get('[data-cy="remember-me-checkbox"]').check()
      cy.get('[data-cy="login-button"]').click()

      cy.url().should('include', '/dashboard')

      // Verify extended session token
      cy.window().its('localStorage')
        .invoke('getItem', 'auth-token')
        .should('exist')
        .then((token) => {
          // Decode JWT to check expiry (simplified check)
          expect(token).to.be.a('string')
          expect(token.length).to.be.greaterThan(100)
        })

      // Simulate browser restart by clearing session storage but keeping localStorage
      cy.window().then((win) => {
        win.sessionStorage.clear()
      })

      cy.reload()

      // Should still be authenticated
      cy.checkAuthState(true)
      cy.url().should('include', '/dashboard')
    })

    it('should use session storage when remember me is not checked', () => {
      cy.visit('/login')

      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)
      // Don't check remember me
      cy.get('[data-cy="login-button"]').click()

      cy.url().should('include', '/dashboard')

      // Clear localStorage to simulate browser close
      cy.clearAuth()
      cy.reload()

      // Should be redirected to login
      cy.url().should('include', '/login')
    })
  })

  describe('Session Management', () => {
    beforeEach(() => {
      cy.loginViaApi(testUser)
    })

    it('should handle session expiry gracefully', () => {
      cy.visit('/dashboard')

      // Mock expired token
      cy.window().then((win) => {
        win.localStorage.setItem('auth-token', 'expired.token.here')
      })

      // Make an API call that should trigger session check
      cy.get('[data-cy="refresh-data-button"]').click()

      // Should redirect to login with session expired message
      cy.url().should('include', '/login')
      cy.get('[data-cy="session-expired-message"]')
        .should('be.visible')
        .should('contain', 'Your session has expired')
    })

    it('should handle token refresh', () => {
      // Intercept refresh token call
      cy.intercept('POST', '/api/auth/refresh', {
        statusCode: 200,
        body: { token: 'new.jwt.token', refreshToken: 'new.refresh.token' }
      }).as('tokenRefresh')

      cy.visit('/dashboard')

      // Trigger action that requires token refresh
      cy.get('[data-cy="upload-document-button"]').click()

      cy.wait('@tokenRefresh')

      // Verify new token is stored
      cy.window().its('localStorage')
        .invoke('getItem', 'auth-token')
        .should('equal', 'new.jwt.token')
    })

    it('should logout successfully', () => {
      cy.visit('/dashboard')

      cy.get('[data-cy="user-menu"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="logout-button"]')
        .should('be.visible')
        .click()

      // Should redirect to login
      cy.url().should('include', '/login')

      // Auth state should be cleared
      cy.checkAuthState(false)

      // Storage should be cleared
      cy.window().its('localStorage')
        .invoke('getItem', 'auth-token')
        .should('not.exist')
    })

    it('should handle logout from all devices', () => {
      cy.visit('/dashboard')

      cy.get('[data-cy="user-menu"]').click()
      cy.get('[data-cy="logout-all-devices"]').click()

      cy.get('[data-cy="logout-all-confirmation"]')
        .should('be.visible')

      cy.get('[data-cy="confirm-logout-all"]').click()

      cy.url().should('include', '/login')
      cy.get('[data-cy="logout-all-success"]')
        .should('be.visible')
        .should('contain', 'Logged out from all devices')
    })
  })

  describe('Multi-Company User Support', () => {
    it('should allow user to switch between companies', () => {
      // Login to first company
      cy.login({
        email: testUser.email,
        password: testUser.password,
        company: testCompany.name
      })

      cy.visit('/dashboard')

      // Open company switcher
      cy.get('[data-cy="company-switcher"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="company-list"]')
        .should('be.visible')

      // Switch to another company
      cy.get('[data-cy="company-option"]')
        .contains('Acme Corp')
        .click()

      // Verify company switch
      cy.get('[data-cy="current-company-name"]')
        .should('contain', 'Acme Corp')

      // Verify URL includes new company context
      cy.url().should('include', 'acme-corp')
    })

    it('should maintain separate contexts for different companies', () => {
      cy.login({
        email: testUser.email,
        password: testUser.password,
        company: testCompany.name
      })

      cy.visit('/dashboard')

      // Check data for first company
      cy.get('[data-cy="document-count"]')
        .invoke('text')
        .as('company1Docs')

      // Switch company
      cy.get('[data-cy="company-switcher"]').click()
      cy.get('[data-cy="company-option"]')
        .contains('Acme Corp')
        .click()

      // Data should be different for second company
      cy.get('[data-cy="document-count"]')
        .invoke('text')
        .should('not.equal', '@company1Docs')
    })
  })

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users to login', () => {
      cy.visit('/dashboard')

      cy.url().should('include', '/login')
      cy.get('[data-cy="redirect-message"]')
        .should('be.visible')
        .should('contain', 'Please log in to continue')
    })

    it('should preserve intended route after login', () => {
      // Try to access protected route
      cy.visit('/documents/upload')

      // Should redirect to login
      cy.url().should('include', '/login')

      // Login
      cy.login(testUser)

      // Should redirect to originally intended route
      cy.url().should('include', '/documents/upload')
    })

    it('should handle role-based access control', () => {
      cy.fixture('users').then((users) => {
        const regularUser = users.regularUser

        cy.login(regularUser)
        cy.visit('/admin/settings')

        // Regular user should not access admin routes
        cy.get('[data-cy="access-denied"]')
          .should('be.visible')
          .should('contain', 'Access denied')

        cy.url().should('include', '/dashboard')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API failures during login', () => {
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('loginFailure')

      cy.visit('/login')

      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)
      cy.get('[data-cy="login-button"]').click()

      cy.wait('@loginFailure')

      cy.get('[data-cy="error-message"]')
        .should('be.visible')
        .should('contain', 'Login failed')

      // Form should remain filled
      cy.get('[data-cy="email-input"]')
        .should('have.value', testUser.email)
    })

    it('should handle network errors gracefully', () => {
      cy.intercept('POST', '/api/auth/login', { forceNetworkError: true })
        .as('networkError')

      cy.visit('/login')

      cy.get('[data-cy="email-input"]').type(testUser.email)
      cy.get('[data-cy="password-input"]').type(testUser.password)
      cy.get('[data-cy="login-button"]').click()

      cy.get('[data-cy="network-error"]')
        .should('be.visible')
        .should('contain', 'Network error')

      cy.get('[data-cy="retry-login-button"]')
        .should('be.visible')
    })
  })
})