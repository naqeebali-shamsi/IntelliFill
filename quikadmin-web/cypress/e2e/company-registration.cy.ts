/// <reference types="cypress" />

/**
 * Company Registration & Onboarding E2E Tests
 * 
 * Tests the complete flow for new company registration including:
 * - Company creation with validation
 * - Initial admin user setup
 * - Trial credits allocation (100 credits)
 * - Onboarding guidance
 * - Company settings configuration
 */

describe('Company Registration & Onboarding', () => {
  const testCompany = {
    name: 'Test Corp ' + Date.now(),
    slug: 'test-corp-' + Date.now(),
    domain: 'testcorp' + Date.now() + '.com',
    industry: 'Technology',
    size: '50-100'
  }

  const adminUser = {
    name: 'Admin User',
    email: `admin${Date.now()}@${testCompany.domain}`,
    password: 'SecurePass123!',
    role: 'admin'
  }

  beforeEach(() => {
    cy.clearAuth()
    cy.visit('/')
  })

  afterEach(() => {
    cy.clearAuth()
  })

  describe('New Company Registration Flow', () => {
    it('should complete full company registration with admin user', () => {
      // Start registration process
      cy.visit('/register')
      cy.get('[data-cy="register-company-button"]').should('be.visible').click()

      // Fill company information
      cy.get('[data-cy="company-name-input"]')
        .should('be.visible')
        .type(testCompany.name)

      cy.get('[data-cy="company-slug-input"]')
        .type(testCompany.slug)
        .should('have.value', testCompany.slug)

      cy.get('[data-cy="company-domain-input"]')
        .type(testCompany.domain)

      cy.get('[data-cy="company-industry-select"]')
        .click()
      cy.get(`[data-value="${testCompany.industry}"]`).click()

      cy.get('[data-cy="company-size-select"]')
        .click()
      cy.get(`[data-value="${testCompany.size}"]`).click()

      // Fill admin user information
      cy.get('[data-cy="admin-name-input"]')
        .type(adminUser.name)

      cy.get('[data-cy="admin-email-input"]')
        .type(adminUser.email)

      cy.get('[data-cy="admin-password-input"]')
        .type(adminUser.password)

      cy.get('[data-cy="admin-password-confirm-input"]')
        .type(adminUser.password)

      // Verify password strength indicator
      cy.get('[data-cy="password-strength-indicator"]')
        .should('be.visible')
        .should('contain', 'Strong')

      // Accept terms and conditions
      cy.get('[data-cy="terms-checkbox"]')
        .check()
        .should('be.checked')

      // Submit registration
      cy.get('[data-cy="register-company-submit"]')
        .should('not.be.disabled')
        .click()

      // Verify registration success
      cy.get('[data-cy="registration-success-message"]')
        .should('be.visible')
        .should('contain', 'Welcome to QuikAdmin!')

      // Verify redirect to onboarding
      cy.url().should('include', '/onboarding')

      // Verify company data is stored
      cy.window().its('localStorage')
        .invoke('getItem', 'company-data')
        .should('exist')
        .then((companyData) => {
          const company = JSON.parse(companyData)
          expect(company.name).to.equal(testCompany.name)
          expect(company.slug).to.equal(testCompany.slug)
        })

      // Verify user is authenticated
      cy.checkAuthState(true)
    })

    it('should validate company slug uniqueness', () => {
      cy.visit('/register')
      cy.get('[data-cy="register-company-button"]').click()

      // Use existing company slug
      cy.get('[data-cy="company-slug-input"]')
        .type('existing-company')
        .blur()

      cy.get('[data-cy="slug-validation-message"]')
        .should('be.visible')
        .should('contain', 'This company slug is already taken')

      cy.get('[data-cy="register-company-submit"]')
        .should('be.disabled')
    })

    it('should validate domain uniqueness', () => {
      cy.visit('/register')
      cy.get('[data-cy="register-company-button"]').click()

      cy.get('[data-cy="company-domain-input"]')
        .type('existing-domain.com')
        .blur()

      cy.get('[data-cy="domain-validation-message"]')
        .should('be.visible')
        .should('contain', 'This domain is already registered')
    })

    it('should enforce password requirements', () => {
      cy.visit('/register')
      cy.get('[data-cy="register-company-button"]').click()

      // Test weak password
      cy.get('[data-cy="admin-password-input"]')
        .type('weak')

      cy.get('[data-cy="password-strength-indicator"]')
        .should('contain', 'Weak')

      cy.get('[data-cy="password-requirements"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="requirement-length"]').should('contain', '✗')
          cy.get('[data-cy="requirement-uppercase"]').should('contain', '✗')
          cy.get('[data-cy="requirement-number"]').should('contain', '✗')
          cy.get('[data-cy="requirement-special"]').should('contain', '✗')
        })

      cy.get('[data-cy="register-company-submit"]')
        .should('be.disabled')
    })
  })

  describe('Onboarding Process', () => {
    beforeEach(() => {
      // Login with test user for onboarding tests
      cy.loginViaApi({
        email: adminUser.email,
        password: adminUser.password,
        company: testCompany.slug
      })
      cy.visit('/onboarding')
    })

    it('should complete onboarding steps', () => {
      // Step 1: Welcome & Company Overview
      cy.get('[data-cy="onboarding-welcome"]')
        .should('be.visible')
        .should('contain', `Welcome to ${testCompany.name}`)

      cy.get('[data-cy="credits-display"]')
        .should('be.visible')
        .should('contain', '100')
        .should('contain', 'trial credits')

      cy.get('[data-cy="next-step-button"]').click()

      // Step 2: Upload First Document
      cy.get('[data-cy="onboarding-upload"]')
        .should('be.visible')

      cy.get('[data-cy="sample-document-link"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="download-sample"]')
        .should('have.attr', 'download')

      cy.get('[data-cy="skip-upload-button"]').click()

      // Step 3: Team Setup
      cy.get('[data-cy="onboarding-team"]')
        .should('be.visible')

      cy.get('[data-cy="invite-team-members"]')
        .should('be.visible')

      // Add team member email
      cy.get('[data-cy="team-member-email"]')
        .type('team@' + testCompany.domain)

      cy.get('[data-cy="team-member-role"]')
        .select('user')

      cy.get('[data-cy="add-team-member"]').click()

      cy.get('[data-cy="team-member-list"]')
        .should('contain', 'team@' + testCompany.domain)

      cy.get('[data-cy="skip-team-setup"]').click()

      // Step 4: Preferences
      cy.get('[data-cy="onboarding-preferences"]')
        .should('be.visible')

      cy.get('[data-cy="notification-preferences"]')
        .should('be.visible')

      cy.get('[data-cy="email-notifications"]')
        .check()

      cy.get('[data-cy="document-processing-notifications"]')
        .check()

      cy.get('[data-cy="finish-onboarding"]').click()

      // Verify completion
      cy.get('[data-cy="onboarding-complete"]')
        .should('be.visible')
        .should('contain', 'Setup Complete!')

      cy.get('[data-cy="go-to-dashboard"]').click()

      cy.url().should('include', '/dashboard')
    })

    it('should allow skipping onboarding steps', () => {
      cy.get('[data-cy="skip-onboarding"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="skip-confirmation-modal"]')
        .should('be.visible')

      cy.get('[data-cy="confirm-skip-onboarding"]').click()

      cy.url().should('include', '/dashboard')

      // Verify onboarding can be resumed later
      cy.get('[data-cy="resume-onboarding"]')
        .should('be.visible')
    })
  })

  describe('Trial Credits Allocation', () => {
    beforeEach(() => {
      cy.loginViaApi({
        email: adminUser.email,
        password: adminUser.password,
        company: testCompany.slug
      })
    })

    it('should allocate 100 trial credits on registration', () => {
      cy.visit('/dashboard')

      cy.get('[data-cy="credits-widget"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="current-credits"]')
            .should('contain', '100')
          
          cy.get('[data-cy="credits-type"]')
            .should('contain', 'Trial')
          
          cy.get('[data-cy="credits-expiry"]')
            .should('be.visible')
        })
    })

    it('should display trial limitations and upgrade options', () => {
      cy.visit('/dashboard')

      cy.get('[data-cy="trial-limitations"]')
        .should('be.visible')
        .should('contain', 'Trial Account')

      cy.get('[data-cy="upgrade-prompt"]')
        .should('be.visible')
        .should('contain', 'Upgrade to unlock')

      cy.get('[data-cy="view-plans-button"]')
        .should('be.visible')
        .click()

      cy.url().should('include', '/pricing')
    })
  })

  describe('Error Handling', () => {
    it('should handle registration API failures gracefully', () => {
      // Intercept and mock API failure
      cy.intercept('POST', '/api/companies/register', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('registrationFailure')

      cy.visit('/register')
      cy.get('[data-cy="register-company-button"]').click()

      // Fill minimum required fields
      cy.get('[data-cy="company-name-input"]').type(testCompany.name)
      cy.get('[data-cy="company-slug-input"]').type(testCompany.slug)
      cy.get('[data-cy="admin-email-input"]').type(adminUser.email)
      cy.get('[data-cy="admin-password-input"]').type(adminUser.password)
      cy.get('[data-cy="terms-checkbox"]').check()

      cy.get('[data-cy="register-company-submit"]').click()

      cy.wait('@registrationFailure')

      cy.get('[data-cy="error-message"]')
        .should('be.visible')
        .should('contain', 'Registration failed')

      // Verify form remains filled
      cy.get('[data-cy="company-name-input"]')
        .should('have.value', testCompany.name)
    })

    it('should handle network connectivity issues', () => {
      cy.intercept('POST', '/api/companies/register', { forceNetworkError: true })
        .as('networkError')

      cy.visit('/register')
      cy.get('[data-cy="register-company-button"]').click()

      // Fill and submit form
      cy.get('[data-cy="company-name-input"]').type(testCompany.name)
      cy.get('[data-cy="terms-checkbox"]').check()
      cy.get('[data-cy="register-company-submit"]').click()

      cy.get('[data-cy="network-error-message"]')
        .should('be.visible')
        .should('contain', 'Network error')

      cy.get('[data-cy="retry-button"]')
        .should('be.visible')
    })
  })

  describe('Form Validation', () => {
    beforeEach(() => {
      cy.visit('/register')
      cy.get('[data-cy="register-company-button"]').click()
    })

    it('should validate required fields', () => {
      cy.get('[data-cy="register-company-submit"]').click()

      cy.get('[data-cy="company-name-error"]')
        .should('be.visible')
        .should('contain', 'Company name is required')

      cy.get('[data-cy="admin-email-error"]')
        .should('be.visible')
        .should('contain', 'Email is required')
    })

    it('should validate email format', () => {
      cy.get('[data-cy="admin-email-input"]')
        .type('invalid-email')
        .blur()

      cy.get('[data-cy="admin-email-error"]')
        .should('be.visible')
        .should('contain', 'Please enter a valid email address')
    })

    it('should validate slug format', () => {
      cy.get('[data-cy="company-slug-input"]')
        .type('Invalid Slug!')
        .blur()

      cy.get('[data-cy="company-slug-error"]')
        .should('be.visible')
        .should('contain', 'Slug can only contain letters, numbers, and hyphens')
    })
  })
})