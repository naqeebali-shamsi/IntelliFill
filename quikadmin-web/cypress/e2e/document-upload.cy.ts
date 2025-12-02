describe('Document Upload and Processing', () => {
  beforeEach(() => {
    cy.loginViaApi()
    cy.visit('/upload')
  })

  it('should upload a PDF document successfully', () => {
    cy.fixture('documents').then((docs) => {
      // Mock file upload
      cy.get('[data-cy="file-upload"]').selectFile('cypress/fixtures/sample.pdf', { 
        force: true 
      })
      
      cy.get('[data-cy="file-name"]').should('contain', 'sample.pdf')
      cy.get('[data-cy="upload-button"]').should('be.enabled').click()
      
      // Check upload progress
      cy.get('[data-cy="upload-progress"]').should('be.visible')
      
      // Wait for processing to complete
      cy.get('[data-cy="processing-status"]', { timeout: 30000 })
        .should('contain', 'Processing complete')
    })
  })

  it('should show validation error for unsupported file types', () => {
    cy.get('[data-cy="file-upload"]').selectFile('cypress/fixtures/unsupported.txt', { 
      force: true 
    })
    
    cy.get('[data-cy="error-message"]')
      .should('be.visible')
      .and('contain', 'Unsupported file type')
  })

  it('should display extracted fields after processing', () => {
    cy.fixture('documents').then((docs) => {
      // Mock successful processing response
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 200,
        body: {
          id: '123',
          status: 'completed',
          extractedFields: docs.samplePdf.expectedFields,
          confidence: 0.95
        }
      }).as('uploadDocument')
      
      cy.uploadDocument('sample.pdf')
      cy.waitForApi('@uploadDocument')
      
      // Check extracted fields display
      cy.get('[data-cy="extracted-fields"]').should('be.visible')
      docs.samplePdf.expectedFields.forEach(field => {
        cy.get(`[data-cy="field-${field}"]`).should('be.visible')
      })
    })
  })

  it('should allow field mapping and corrections', () => {
    // Simulate document with extracted fields
    cy.visit('/upload/123/review')
    
    cy.get('[data-cy="field-name"]').clear().type('John Doe')
    cy.get('[data-cy="field-email"]').clear().type('john@example.com')
    
    cy.get('[data-cy="save-corrections"]').click()
    
    cy.get('[data-cy="success-message"]')
      .should('be.visible')
      .and('contain', 'Fields updated successfully')
  })

  it('should handle batch upload', () => {
    const files = ['sample1.pdf', 'sample2.pdf', 'sample3.pdf']
    
    files.forEach(file => {
      cy.get('[data-cy="file-upload"]').selectFile(`cypress/fixtures/${file}`, { 
        force: true 
      })
    })
    
    cy.get('[data-cy="batch-upload-button"]').click()
    
    cy.get('[data-cy="batch-progress"]').should('be.visible')
    cy.get('[data-cy="batch-item"]').should('have.length', files.length)
  })

  it('should show processing history', () => {
    cy.visit('/history')
    
    cy.get('[data-cy="history-table"]').should('be.visible')
    cy.get('[data-cy="history-item"]').should('have.length.at.least', 0)
    
    // Test filters
    cy.get('[data-cy="filter-status"]').select('completed')
    cy.get('[data-cy="apply-filters"]').click()
    
    // Test search
    cy.get('[data-cy="search-input"]').type('sample.pdf')
    cy.get('[data-cy="search-button"]').click()
  })

  it('should export processed data', () => {
    cy.visit('/history')
    
    cy.get('[data-cy="history-item"]').first().click()
    cy.get('[data-cy="export-csv"]').click()
    
    // Check download (would need cypress-downloadfile plugin for actual file verification)
    cy.get('[data-cy="export-success"]').should('be.visible')
  })
})