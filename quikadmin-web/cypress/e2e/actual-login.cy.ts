/// <reference types="cypress" />

/**
 * Actual Login Test - Using real selectors from the application
 */

describe('Actual Login Flow', () => {
  beforeEach(() => {
    // Clear any existing auth state
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
  })

  it('should display login page correctly', () => {
    cy.visit('/login')
    
    // Check page title
    cy.contains('Welcome back').should('be.visible')
    cy.contains('Enter your credentials to access your account').should('be.visible')
    
    // Check form inputs exist (using actual IDs from Login.tsx)
    cy.get('#companySlug').should('be.visible')
    cy.get('#email').should('be.visible')
    cy.get('#password').should('be.visible')
    
    // Check buttons
    cy.contains('button', 'Sign in').should('be.visible')
    cy.contains('button', 'Use demo credentials').should('be.visible')
    
    // Check links
    cy.contains('Forgot password?').should('be.visible')
    cy.contains("Don't have an account?").should('be.visible')
  })

  it('should fill demo credentials', () => {
    cy.visit('/login')
    
    // Click demo credentials button
    cy.contains('button', 'Use demo credentials').click()
    
    // Check if fields are populated
    cy.get('#email').should('have.value', 'admin@example.com')
    cy.get('#password').should('have.value', 'admin123')
    cy.get('#companySlug').should('have.value', 'demo-company')
  })

  it('should show/hide password', () => {
    cy.visit('/login')
    
    // Type password
    cy.get('#password').type('testpassword')
    
    // Initially password should be hidden
    cy.get('#password').should('have.attr', 'type', 'password')
    
    // Click eye icon to show password
    cy.get('button').find('svg.lucide-eye').parent().click()
    cy.get('#password').should('have.attr', 'type', 'text')
    
    // Click again to hide
    cy.get('button').find('svg.lucide-eye-off').parent().click()
    cy.get('#password').should('have.attr', 'type', 'password')
  })

  it('should validate required fields', () => {
    cy.visit('/login')
    
    // Try to submit without filling fields
    cy.contains('button', 'Sign in').click()
    
    // Check HTML5 validation (browser native)
    cy.get('#email:invalid').should('exist')
    cy.get('#password:invalid').should('exist')
  })

  it('should handle login attempt', () => {
    cy.visit('/login')
    
    // Fill in the form with test data
    cy.get('#companySlug').type('test-company')
    cy.get('#email').type('test@example.com')
    cy.get('#password').type('TestPassword123!')
    
    // Intercept the login API call
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 401,
      body: { error: 'Invalid credentials' }
    }).as('loginAttempt')
    
    // Submit form
    cy.contains('button', 'Sign in').click()
    
    // Wait for API call
    cy.wait('@loginAttempt')
    
    // Should show error alert
    cy.get('[role="alert"]').should('be.visible')
  })

  it('should toggle remember me checkbox', () => {
    cy.visit('/login')
    
    // Find and click the checkbox
    cy.get('#rememberMe').should('not.be.checked')
    cy.get('label[for="rememberMe"]').click()
    cy.get('#rememberMe').should('be.checked')
  })

  it('should navigate to register page', () => {
    cy.visit('/login')
    
    // Click sign up link
    cy.contains('Sign up').click()
    
    // Should navigate to register page
    cy.url().should('include', '/register')
  })

  it('should handle successful login flow (mocked)', () => {
    cy.visit('/login')
    
    // Mock successful login response
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: '123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'admin'
          },
          tokens: {
            accessToken: 'mock-jwt-token',
            refreshToken: 'mock-refresh-token',
            expiresAt: Date.now() + 3600000
          }
        }
      }
    }).as('successfulLogin')
    
    // Mock Neon login
    cy.intercept('POST', '**/api/neon-auth/login', {
      statusCode: 200,
      body: {
        success: true,
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner'
        },
        company: {
          id: 'company-123',
          name: 'Test Company',
          slug: 'test-company',
          tier: 'trial',
          creditsRemaining: 100
        },
        token: 'mock-neon-token'
      }
    }).as('neonLogin')
    
    // Fill and submit form
    cy.get('#companySlug').type('test-company')
    cy.get('#email').type('test@example.com')
    cy.get('#password').type('TestPassword123!')
    cy.contains('button', 'Sign in').click()
    
    // Wait for API calls
    cy.wait('@successfulLogin')
    
    // Should redirect to dashboard
    cy.url().should('include', '/dashboard')
  })
})