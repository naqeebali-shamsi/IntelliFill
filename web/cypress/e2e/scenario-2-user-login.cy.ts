/// <reference types="cypress" />

/**
 * Scenario 2: Existing User Login
 * Tests returning user accessing their account with company context
 */

describe('Scenario 2: Existing User Login', () => {
  const existingUser = {
    email: 'admin@techstart.com',
    password: 'SecurePass123!',
    companySlug: 'techstart-2024',
    companyName: 'TechStart Inc',
    role: 'owner'
  }

  beforeEach(() => {
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
    cy.visit('/login')
  })

  describe('Direct Login Without Company', () => {
    it('should show login form elements', () => {
      // Check all form elements are present
      cy.get('#companySlug').should('be.visible')
      cy.get('#email').should('be.visible')
      cy.get('#password').should('be.visible')
      cy.contains('button', 'Sign in').should('be.visible')
    })

    it('should attempt login without company slug', () => {
      // Mock API to return error
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 400,
        body: {
          error: 'Company context required'
        }
      }).as('loginNoCompany')

      // Fill only email and password
      cy.get('#email').type(existingUser.email)
      cy.get('#password').type(existingUser.password)
      
      // Submit
      cy.contains('button', 'Sign in').click()
      
      // Wait for API call
      cy.wait('@loginNoCompany')
      
      // Should show error
      cy.contains(/company|context/i).should('be.visible')
    })
  })

  describe('Company-Specific Login', () => {
    it('should login with company slug successfully', () => {
      // Mock successful login
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            user: {
              id: 'user-123',
              email: existingUser.email,
              name: 'John Doe',
              role: existingUser.role
            },
            tokens: {
              accessToken: 'mock-jwt-token',
              refreshToken: 'mock-refresh-token',
              expiresAt: Date.now() + 3600000
            }
          }
        }
      }).as('successLogin')

      cy.intercept('POST', '**/api/neon-auth/login', {
        statusCode: 200,
        body: {
          success: true,
          user: {
            id: 'user-123',
            email: existingUser.email,
            name: 'John Doe',
            role: existingUser.role
          },
          company: {
            id: 'company-123',
            name: existingUser.companyName,
            slug: existingUser.companySlug,
            tier: 'professional',
            creditsRemaining: 850
          },
          token: 'mock-neon-token'
        }
      }).as('neonLogin')

      // Fill complete form
      cy.get('#companySlug').type(existingUser.companySlug)
      cy.get('#email').type(existingUser.email)
      cy.get('#password').type(existingUser.password)
      
      // Submit
      cy.contains('button', 'Sign in').click()
      
      // Wait for successful login
      cy.wait('@successLogin')
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard')
      
      // Verify user is logged in
      cy.contains('Dashboard').should('be.visible')
    })

    it('should handle remember me functionality', () => {
      // Check remember me checkbox
      cy.get('#rememberMe').check()
      
      // Mock login
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            user: { id: 'user-123' },
            tokens: { accessToken: 'token', expiresAt: Date.now() + 3600000 }
          }
        }
      }).as('loginRemember')

      // Login
      cy.get('#companySlug').type(existingUser.companySlug)
      cy.get('#email').type(existingUser.email)
      cy.get('#password').type(existingUser.password)
      cy.contains('button', 'Sign in').click()
      
      cy.wait('@loginRemember')
      
      // Check that auth state is in localStorage (persistent)
      cy.window().then((win) => {
        const authState = win.localStorage.getItem('intellifill-auth')
        expect(authState).to.not.be.null
        const parsed = JSON.parse(authState || '{}')
        expect(parsed.state?.rememberMe).to.be.true
      })
    })

    it('should show loading state during login', () => {
      // Intercept with delay
      cy.intercept('POST', '**/api/auth/login', (req) => {
        req.reply({
          delay: 2000,
          statusCode: 200,
          body: { success: true, data: { user: {}, tokens: {} } }
        })
      }).as('slowLogin')

      // Fill and submit
      cy.get('#companySlug').type(existingUser.companySlug)
      cy.get('#email').type(existingUser.email)
      cy.get('#password').type(existingUser.password)
      cy.contains('button', 'Sign in').click()
      
      // Check for loading indicator
      cy.contains(/signing in|loading/i).should('be.visible')
    })
  })

  describe('Session Persistence', () => {
    it('should maintain session on page refresh', () => {
      // Set up authenticated session
      cy.window().then((win) => {
        win.localStorage.setItem('intellifill-auth', JSON.stringify({
          state: {
            user: { id: 'user-123', email: existingUser.email },
            company: { id: 'company-123', name: existingUser.companyName },
            tokens: { accessToken: 'token', expiresAt: Date.now() + 3600000 },
            isAuthenticated: true
          }
        }))
      })

      // Visit dashboard
      cy.visit('/dashboard')
      cy.contains('Dashboard').should('be.visible')
      
      // Refresh page
      cy.reload()
      
      // Should still be authenticated
      cy.contains('Dashboard').should('be.visible')
      cy.url().should('include', '/dashboard')
    })

    it('should clear session on logout', () => {
      // Set up session
      cy.window().then((win) => {
        win.localStorage.setItem('intellifill-auth', JSON.stringify({
          state: {
            isAuthenticated: true,
            user: { id: 'user-123' },
            tokens: { accessToken: 'token' }
          }
        }))
      })

      cy.visit('/dashboard')
      
      // Find and click logout
      cy.contains(/logout|sign out/i).click()
      
      // Should redirect to login
      cy.url().should('include', '/login')
      
      // Check session cleared
      cy.window().then((win) => {
        const authState = win.localStorage.getItem('intellifill-auth')
        if (authState) {
          const parsed = JSON.parse(authState)
          expect(parsed.state?.isAuthenticated).to.be.false
        }
      })
    })

    it('should handle session expiry', () => {
      // Set expired session
      cy.window().then((win) => {
        win.localStorage.setItem('intellifill-auth', JSON.stringify({
          state: {
            isAuthenticated: true,
            tokens: { 
              accessToken: 'expired-token',
              expiresAt: Date.now() - 1000 // Expired
            }
          }
        }))
      })

      // Try to visit protected route
      cy.visit('/dashboard')
      
      // Should redirect to login with expired message
      cy.url().should('include', '/login')
      cy.contains(/expired|session/i).should('be.visible')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid credentials', () => {
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 401,
        body: {
          error: 'Invalid email or password'
        }
      }).as('invalidLogin')

      // Try invalid login
      cy.get('#companySlug').type(existingUser.companySlug)
      cy.get('#email').type(existingUser.email)
      cy.get('#password').type('wrongpassword')
      cy.contains('button', 'Sign in').click()
      
      cy.wait('@invalidLogin')
      
      // Check error message
      cy.contains(/invalid|incorrect/i).should('be.visible')
    })

    it('should handle network errors gracefully', () => {
      cy.intercept('POST', '**/api/auth/login', {
        forceNetworkError: true
      }).as('networkError')

      // Try login
      cy.get('#companySlug').type(existingUser.companySlug)
      cy.get('#email').type(existingUser.email)
      cy.get('#password').type(existingUser.password)
      cy.contains('button', 'Sign in').click()
      
      // Should show network error
      cy.contains(/network|connection|failed/i).should('be.visible')
    })

    it('should handle server errors', () => {
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 500,
        body: {
          error: 'Internal server error'
        }
      }).as('serverError')

      // Try login
      cy.get('#companySlug').type(existingUser.companySlug)
      cy.get('#email').type(existingUser.email)
      cy.get('#password').type(existingUser.password)
      cy.contains('button', 'Sign in').click()
      
      cy.wait('@serverError')
      
      // Should show error
      cy.contains(/error|failed|try again/i).should('be.visible')
    })
  })

  describe('Password Management', () => {
    it('should toggle password visibility', () => {
      // Type password
      cy.get('#password').type('testpassword')
      
      // Initially hidden
      cy.get('#password').should('have.attr', 'type', 'password')
      
      // Click eye icon to show
      cy.get('button').find('svg.lucide-eye').parent().click()
      cy.get('#password').should('have.attr', 'type', 'text')
      
      // Click again to hide
      cy.get('button').find('svg.lucide-eye-off').parent().click()
      cy.get('#password').should('have.attr', 'type', 'password')
    })

    it('should navigate to forgot password', () => {
      // Click forgot password link
      cy.contains('Forgot password?').click()
      
      // Should navigate to reset page
      cy.url().should('include', '/forgot-password')
    })
  })

  describe('Demo Mode', () => {
    it('should fill demo credentials', () => {
      // Click demo button
      cy.contains('button', 'demo credentials').click()
      
      // Check fields are filled
      cy.get('#email').should('have.value', 'admin@example.com')
      cy.get('#password').should('have.value', 'admin123')
      cy.get('#companySlug').should('have.value', 'demo-company')
    })
  })
})