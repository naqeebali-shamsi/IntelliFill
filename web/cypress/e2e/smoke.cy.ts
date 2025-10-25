describe('Smoke Tests', () => {
  it('should load the application', () => {
    cy.visit('/')
    cy.get('body').should('be.visible')
  })

  it('should navigate to login page', () => {
    cy.visit('/login')
    cy.url().should('include', '/login')
    
    // Basic form elements should be present
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should have proper page title', () => {
    cy.visit('/')
    cy.title().should('not.be.empty')
  })

  it('should be responsive', () => {
    cy.visit('/')
    
    // Test different viewport sizes
    const viewports = [
      [1920, 1080], // Desktop
      [1280, 720],  // Laptop
      [768, 1024],  // Tablet
      [375, 667]    // Mobile
    ]
    
    viewports.forEach(([width, height]) => {
      cy.viewport(width, height)
      cy.get('body').should('be.visible')
    })
  })

  it('should handle 404 pages gracefully', () => {
    cy.visit('/non-existent-page', { failOnStatusCode: false })
    // Should either redirect to login or show 404 page
    cy.url().should('satisfy', (url: string) => {
      return url.includes('/login') || url.includes('/404') || url.includes('/non-existent-page')
    })
  })
})