describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.clearAuth()
  })

  it('should login successfully with valid credentials', () => {
    cy.fixture('users').then((users) => {
      cy.visit('/login')
      
      cy.get('[data-cy="email-input"]').type(users.testUser.email)
      cy.get('[data-cy="password-input"]').type(users.testUser.password)
      
      if (users.testUser.company) {
        cy.get('[data-cy="company-input"]').type(users.testUser.company)
      }
      
      cy.get('[data-cy="login-button"]').click()
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard')
      cy.checkAuthState(true)
    })
  })

  it('should show error for invalid credentials', () => {
    cy.visit('/login')
    
    cy.get('[data-cy="email-input"]').type('invalid@test.com')
    cy.get('[data-cy="password-input"]').type('wrongpassword')
    cy.get('[data-cy="login-button"]').click()
    
    cy.get('[data-cy="error-message"]').should('be.visible')
    cy.url().should('include', '/login')
    cy.checkAuthState(false)
  })

  it('should logout successfully', () => {
    cy.loginViaApi()
    cy.visit('/dashboard')
    
    cy.logout()
    
    cy.url().should('include', '/login')
    cy.checkAuthState(false)
  })

  it('should redirect to login when accessing protected route without auth', () => {
    cy.visit('/dashboard')
    cy.url().should('include', '/login')
  })

  it('should handle multi-tenant authentication', () => {
    cy.fixture('users').then((users) => {
      // Login with first company
      cy.login({
        email: users.testUser.email,
        password: users.testUser.password,
        company: users.testUser.company
      })
      
      cy.url().should('include', '/dashboard')
      
      // Logout and login with different company
      cy.logout()
      
      cy.login({
        email: users.anotherCompanyUser.email,
        password: users.anotherCompanyUser.password,
        company: users.anotherCompanyUser.company
      })
      
      cy.url().should('include', '/dashboard')
    })
  })

  it('should maintain session after page reload', () => {
    cy.loginViaApi()
    cy.visit('/dashboard')
    
    cy.reload()
    
    cy.url().should('include', '/dashboard')
    cy.checkAuthState(true)
  })
})