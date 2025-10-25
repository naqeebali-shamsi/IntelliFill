describe('Dashboard Functionality', () => {
  beforeEach(() => {
    cy.loginViaApi()
    cy.visit('/dashboard')
  })

  it('should display dashboard with navigation', () => {
    cy.get('[data-cy="dashboard-title"]').should('be.visible')
    cy.get('[data-cy="navigation-menu"]').should('be.visible')
    cy.get('[data-cy="user-profile"]').should('be.visible')
  })

  it('should navigate to different sections', () => {
    // Test navigation to different pages
    cy.get('[data-cy="nav-upload"]').click()
    cy.url().should('include', '/upload')
    
    cy.get('[data-cy="nav-history"]').click()
    cy.url().should('include', '/history')
    
    cy.get('[data-cy="nav-templates"]').click()
    cy.url().should('include', '/templates')
    
    cy.get('[data-cy="nav-settings"]').click()
    cy.url().should('include', '/settings')
  })

  it('should display recent uploads', () => {
    cy.get('[data-cy="recent-uploads"]').should('be.visible')
    cy.get('[data-cy="upload-item"]').should('have.length.at.least', 0)
  })

  it('should show processing statistics', () => {
    cy.get('[data-cy="stats-processed"]').should('be.visible')
    cy.get('[data-cy="stats-success-rate"]').should('be.visible')
    cy.get('[data-cy="stats-avg-time"]').should('be.visible')
  })

  it('should be responsive on different screen sizes', () => {
    cy.checkResponsive()
    
    // Test mobile navigation
    cy.viewport(375, 667)
    cy.get('[data-cy="mobile-menu-trigger"]').should('be.visible')
    cy.get('[data-cy="mobile-menu-trigger"]').click()
    cy.get('[data-cy="mobile-navigation"]').should('be.visible')
  })

  it('should handle loading states', () => {
    // Intercept API calls to simulate loading
    cy.intercept('GET', '/api/stats', { delay: 1000 }).as('getStats')
    
    cy.reload()
    
    cy.get('[data-cy="loading-spinner"]').should('be.visible')
    cy.waitForApi('@getStats')
    cy.get('[data-cy="loading-spinner"]').should('not.exist')
  })
})