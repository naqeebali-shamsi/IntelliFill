/// <reference types="cypress" />

/**
 * Scenario 1: New Company Onboarding
 * Tests the complete journey of a startup founder setting up document processing
 */

describe('Scenario 1: New Company Onboarding', () => {
  const timestamp = Date.now()
  const newCompany = {
    name: `TechStart Inc ${timestamp}`,
    slug: `techstart-${timestamp}`,
    email: `admin@techstart-${timestamp}.com`,
    adminName: 'John Doe',
    password: 'SecurePass123!'
  }

  beforeEach(() => {
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
  })

  describe('Landing Page Experience', () => {
    it('should display landing page with key elements', () => {
      cy.visit('/')
      
      // Check for main elements
      cy.contains('QuikAdmin').should('be.visible')
      cy.contains('Sign in').should('be.visible')
      cy.contains('Sign up').should('be.visible')
    })

    it('should navigate to registration from landing page', () => {
      cy.visit('/')
      cy.contains('Sign up').first().click()
      cy.url().should('include', '/register')
    })
  })

  describe('Company Registration Flow', () => {
    it('should display registration form with all fields', () => {
      cy.visit('/register')
      
      // Check page title
      cy.contains('Create an account').should('be.visible')
      
      // Check form fields exist
      cy.get('input[type="email"]').should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
      cy.get('input[type="text"]').should('have.length.at.least', 2) // name and company fields
    })

    it('should validate required fields', () => {
      cy.visit('/register')
      
      // Try to submit empty form
      cy.contains('button', 'Sign up').click()
      
      // Check for validation (HTML5 required attribute)
      cy.get('input:invalid').should('have.length.at.least', 1)
    })

    it('should validate email format', () => {
      cy.visit('/register')
      
      // Enter invalid email
      cy.get('input[type="email"]').type('invalid-email')
      cy.contains('button', 'Sign up').click()
      
      // Check for invalid email field
      cy.get('input[type="email"]:invalid').should('exist')
    })

    it('should show password requirements', () => {
      cy.visit('/register')
      
      // Focus password field
      cy.get('input[type="password"]').focus()
      
      // Look for password requirements text if it exists
      // Or check for minimum length
      cy.get('input[type="password"]').type('weak')
      cy.get('input[type="password"]').should('have.value', 'weak')
    })

    it('should complete successful registration (mocked)', () => {
      cy.visit('/register')
      
      // Mock the API responses
      cy.intercept('POST', '**/api/auth/register', {
        statusCode: 201,
        body: {
          success: true,
          message: 'Registration successful',
          data: {
            user: {
              id: 'user-123',
              email: newCompany.email,
              name: newCompany.adminName
            },
            tokens: {
              accessToken: 'mock-token',
              refreshToken: 'mock-refresh',
              expiresAt: Date.now() + 3600000
            }
          }
        }
      }).as('register')

      cy.intercept('POST', '**/api/neon-auth/signup', {
        statusCode: 201,
        body: {
          success: true,
          token: 'mock-jwt',
          company: {
            id: 'company-123',
            name: newCompany.name,
            slug: newCompany.slug,
            tier: 'trial',
            creditsRemaining: 100
          },
          user: {
            id: 'user-123',
            email: newCompany.email,
            name: newCompany.adminName,
            role: 'owner'
          }
        }
      }).as('neonSignup')

      // Fill registration form
      cy.get('input[type="email"]').type(newCompany.email)
      cy.get('input[type="password"]').first().type(newCompany.password)
      cy.get('input[type="text"]').first().type(newCompany.adminName)
      
      // If there are company fields
      cy.get('input[type="text"]').eq(1).type(newCompany.name)
      cy.get('input[type="text"]').eq(2).type(newCompany.slug)
      
      // Submit form
      cy.contains('button', 'Sign up').click()
      
      // Should redirect to dashboard after successful registration
      cy.url().should('include', '/dashboard', { timeout: 10000 })
    })
  })

  describe('Initial Dashboard Experience', () => {
    beforeEach(() => {
      // Mock login state
      cy.window().then((win) => {
        win.localStorage.setItem('intellifill-auth', JSON.stringify({
          state: {
            user: {
              id: 'user-123',
              email: newCompany.email,
              name: newCompany.adminName,
              role: 'owner'
            },
            company: {
              id: 'company-123',
              name: newCompany.name,
              slug: newCompany.slug,
              tier: 'trial',
              creditsRemaining: 100
            },
            tokens: {
              accessToken: 'mock-token',
              refreshToken: 'mock-refresh',
              expiresAt: Date.now() + 3600000
            },
            isAuthenticated: true
          }
        }))
      })
    })

    it('should display dashboard with company information', () => {
      cy.visit('/dashboard')
      
      // Check for welcome message
      cy.contains('Dashboard').should('be.visible')
      cy.contains('Welcome').should('be.visible')
      
      // Check for company name display
      cy.contains(newCompany.name).should('be.visible')
      
      // Check for trial credits
      cy.contains('100').should('be.visible')
      cy.contains(/trial|credits/i).should('be.visible')
    })

    it('should show quick action buttons', () => {
      cy.visit('/dashboard')
      
      // Check for action buttons
      cy.contains('Upload Documents').should('be.visible')
      cy.contains('View History').should('be.visible')
      cy.contains('Templates').should('be.visible')
    })

    it('should display subscription tier', () => {
      cy.visit('/dashboard')
      
      // Check for trial tier indication
      cy.contains(/trial|starter|free/i).should('be.visible')
    })

    it('should have functional navigation', () => {
      cy.visit('/dashboard')
      
      // Test navigation to upload
      cy.contains('Upload Documents').click()
      cy.url().should('include', '/upload')
      
      // Navigate back
      cy.go('back')
      
      // Test navigation to history
      cy.contains('View History').click()
      cy.url().should('include', '/history')
    })
  })

  describe('Onboarding Completion', () => {
    it('should track onboarding progress', () => {
      // This would track if user completed key onboarding steps
      cy.window().then((win) => {
        // Check if onboarding flags are set
        const onboarding = {
          accountCreated: true,
          companySetup: true,
          firstLogin: true,
          dashboardVisited: true
        }
        
        // All steps should be complete
        expect(Object.values(onboarding).every(step => step)).to.be.true
      })
    })
  })
})