/// <reference types="cypress" />

/**
 * Document Processing Workflow E2E Tests
 * 
 * Tests the complete document processing pipeline including:
 * - File upload with validation and progress tracking
 * - Document parsing and field extraction
 * - AI-powered form filling and field mapping
 * - Template management and reuse
 * - Processing status monitoring
 * - Download and export functionality
 * - Credit consumption tracking
 */

describe('Document Processing Workflow', () => {
  let testUser: any
  let testCompany: any

  before(() => {
    cy.fixture('users').then((users) => {
      testUser = users.testUser
      testCompany = users.companies[0]
    })
  })

  beforeEach(() => {
    cy.loginViaApi(testUser)
    cy.visit('/documents/upload')
  })

  afterEach(() => {
    cy.clearAuth()
  })

  describe('File Upload Functionality', () => {
    it('should upload PDF document successfully', () => {
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 200,
        body: {
          documentId: 'doc_123',
          status: 'uploaded',
          fileName: 'sample.pdf',
          fileSize: 1024576,
          pages: 3
        }
      }).as('documentUpload')

      // Verify upload interface
      cy.get('[data-cy="upload-zone"]')
        .should('be.visible')
        .should('contain', 'Drag and drop files here')

      cy.get('[data-cy="file-input"]')
        .should('exist')

      cy.get('[data-cy="supported-formats"]')
        .should('be.visible')
        .should('contain', 'PDF, DOCX, DOC, PNG, JPG')

      // Upload file
      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      // Verify upload progress
      cy.get('[data-cy="upload-progress"]')
        .should('be.visible')

      cy.get('[data-cy="upload-progress-bar"]')
        .should('have.attr', 'value')

      cy.wait('@documentUpload')

      // Verify upload success
      cy.get('[data-cy="upload-success"]')
        .should('be.visible')
        .should('contain', 'Document uploaded successfully')

      cy.get('[data-cy="document-preview"]')
        .should('be.visible')

      cy.get('[data-cy="document-info"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="file-name"]').should('contain', 'sample.pdf')
          cy.get('[data-cy="file-size"]').should('contain', '1 MB')
          cy.get('[data-cy="page-count"]').should('contain', '3 pages')
        })

      // Verify next step button is enabled
      cy.get('[data-cy="start-processing-button"]')
        .should('be.visible')
        .should('not.be.disabled')
    })

    it('should upload multiple documents', () => {
      const documents = ['sample.pdf', 'test-form.docx']

      documents.forEach((fileName, index) => {
        cy.intercept('POST', '/api/documents/upload', {
          statusCode: 200,
          body: {
            documentId: `doc_${index + 1}`,
            status: 'uploaded',
            fileName: fileName
          }
        }).as(`documentUpload${index}`)
      })

      // Upload multiple files
      cy.get('[data-cy="file-input"]').selectFile([
        'cypress/fixtures/sample.pdf',
        'cypress/fixtures/test-form.docx'
      ], { force: true })

      // Verify both uploads
      cy.get('[data-cy="uploaded-files-list"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="uploaded-file"]').should('have.length', 2)
          cy.contains('sample.pdf').should('be.visible')
          cy.contains('test-form.docx').should('be.visible')
        })

      cy.get('[data-cy="batch-process-button"]')
        .should('be.visible')
        .should('not.be.disabled')
    })

    it('should validate file types and sizes', () => {
      // Test unsupported file type
      cy.get('[data-cy="file-input"]').selectFile(
        'cypress/fixtures/unsupported.txt',
        { force: true }
      )

      cy.get('[data-cy="file-type-error"]')
        .should('be.visible')
        .should('contain', 'Unsupported file type')

      // Test oversized file (mock large file)
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 413,
        body: { error: 'File too large' }
      }).as('fileTooLarge')

      const largeFile = new File(['x'.repeat(50 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf'
      })

      cy.get('[data-cy="file-input"]').selectFile(largeFile, { force: true })

      cy.get('[data-cy="file-size-error"]')
        .should('be.visible')
        .should('contain', 'File size exceeds limit')
    })

    it('should handle upload failures gracefully', () => {
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 500,
        body: { error: 'Upload failed' }
      }).as('uploadFailure')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.wait('@uploadFailure')

      cy.get('[data-cy="upload-error"]')
        .should('be.visible')
        .should('contain', 'Upload failed')

      cy.get('[data-cy="retry-upload-button"]')
        .should('be.visible')
        .click()

      // Should retry upload
      cy.get('[data-cy="upload-progress"]').should('be.visible')
    })
  })

  describe('Document Processing Pipeline', () => {
    beforeEach(() => {
      // Mock successful upload first
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 200,
        body: {
          documentId: 'doc_123',
          status: 'uploaded',
          fileName: 'sample.pdf'
        }
      }).as('documentUpload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.wait('@documentUpload')
    })

    it('should process document with AI field extraction', () => {
      cy.intercept('POST', '/api/documents/doc_123/process', {
        statusCode: 200,
        body: {
          jobId: 'job_456',
          status: 'processing'
        }
      }).as('startProcessing')

      cy.intercept('GET', '/api/jobs/job_456/status', {
        statusCode: 200,
        body: {
          status: 'completed',
          result: {
            extractedFields: {
              name: 'John Doe',
              email: 'john@example.com',
              phone: '555-1234',
              address: '123 Main St'
            },
            confidence: 0.95,
            processingTime: 2500
          }
        }
      }).as('processingStatus')

      // Start processing
      cy.get('[data-cy="start-processing-button"]').click()

      // Verify processing started
      cy.wait('@startProcessing')

      cy.get('[data-cy="processing-status"]')
        .should('be.visible')
        .should('contain', 'Processing document')

      cy.get('[data-cy="processing-spinner"]').should('be.visible')

      // Check processing status
      cy.wait('@processingStatus')

      // Verify results
      cy.get('[data-cy="processing-complete"]')
        .should('be.visible')
        .should('contain', 'Processing complete')

      cy.get('[data-cy="extracted-fields"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="field-name"]').should('contain', 'John Doe')
          cy.get('[data-cy="field-email"]').should('contain', 'john@example.com')
          cy.get('[data-cy="field-phone"]').should('contain', '555-1234')
          cy.get('[data-cy="field-address"]').should('contain', '123 Main St')
        })

      cy.get('[data-cy="confidence-score"]')
        .should('be.visible')
        .should('contain', '95%')

      cy.get('[data-cy="processing-time"]')
        .should('be.visible')
        .should('contain', '2.5s')
    })

    it('should monitor processing status in real-time', () => {
      const statusSequence = [
        { status: 'queued' },
        { status: 'processing', progress: 25 },
        { status: 'processing', progress: 50 },
        { status: 'processing', progress: 75 },
        { status: 'completed', result: { extractedFields: {} } }
      ]

      cy.intercept('POST', '/api/documents/doc_123/process', {
        statusCode: 200,
        body: { jobId: 'job_456', status: 'queued' }
      }).as('startProcessing')

      // Setup sequential status responses
      statusSequence.forEach((response, index) => {
        cy.intercept('GET', '/api/jobs/job_456/status', {
          statusCode: 200,
          body: response
        }).as(`status_${index}`)
      })

      cy.get('[data-cy="start-processing-button"]').click()
      cy.wait('@startProcessing')

      // Verify status progression
      cy.get('[data-cy="status-queued"]').should('be.visible')

      cy.get('[data-cy="progress-bar"]')
        .should('be.visible')
        .should('have.attr', 'value', '0')

      // Progress should update
      cy.get('[data-cy="progress-bar"]')
        .should('have.attr', 'value', '25')

      cy.get('[data-cy="progress-bar"]')
        .should('have.attr', 'value', '50')

      cy.get('[data-cy="processing-complete"]')
        .should('eventually.be.visible')
    })

    it('should handle processing failures', () => {
      cy.intercept('POST', '/api/documents/doc_123/process', {
        statusCode: 200,
        body: { jobId: 'job_456', status: 'processing' }
      }).as('startProcessing')

      cy.intercept('GET', '/api/jobs/job_456/status', {
        statusCode: 200,
        body: {
          status: 'failed',
          error: 'Document format not supported'
        }
      }).as('processingFailed')

      cy.get('[data-cy="start-processing-button"]').click()
      cy.wait('@startProcessing')
      cy.wait('@processingFailed')

      cy.get('[data-cy="processing-error"]')
        .should('be.visible')
        .should('contain', 'Processing failed')

      cy.get('[data-cy="error-details"]')
        .should('be.visible')
        .should('contain', 'Document format not supported')

      cy.get('[data-cy="retry-processing-button"]')
        .should('be.visible')
    })
  })

  describe('Field Mapping and Validation', () => {
    beforeEach(() => {
      // Setup processed document
      cy.visit('/documents/doc_123/review')
    })

    it('should display extracted fields for review', () => {
      cy.intercept('GET', '/api/documents/doc_123', {
        statusCode: 200,
        body: {
          documentId: 'doc_123',
          status: 'processed',
          extractedFields: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '555-1234'
          },
          confidence: {
            firstName: 0.98,
            lastName: 0.95,
            email: 0.92,
            phone: 0.88
          }
        }
      }).as('getDocument')

      cy.wait('@getDocument')

      cy.get('[data-cy="field-review-section"]')
        .should('be.visible')

      cy.get('[data-cy="extracted-field"]')
        .should('have.length.greaterThan', 0)

      // Check each field with confidence indicator
      cy.get('[data-cy="field-firstName"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="field-value"]').should('contain', 'John')
          cy.get('[data-cy="confidence-indicator"]').should('contain', '98%')
          cy.get('[data-cy="confidence-high"]').should('exist')
        })

      cy.get('[data-cy="field-phone"]')
        .within(() => {
          cy.get('[data-cy="confidence-indicator"]').should('contain', '88%')
          cy.get('[data-cy="confidence-medium"]').should('exist')
        })
    })

    it('should allow manual field correction', () => {
      cy.intercept('PUT', '/api/documents/doc_123/fields', {
        statusCode: 200,
        body: { success: true }
      }).as('updateFields')

      cy.get('[data-cy="field-email"]')
        .within(() => {
          cy.get('[data-cy="edit-field-button"]').click()
          cy.get('[data-cy="field-input"]')
            .clear()
            .type('corrected@example.com')
          cy.get('[data-cy="save-field-button"]').click()
        })

      cy.wait('@updateFields')

      cy.get('[data-cy="field-updated-notification"]')
        .should('be.visible')

      // Verify field is marked as manually corrected
      cy.get('[data-cy="field-email"]')
        .should('have.class', 'manually-corrected')
    })

    it('should suggest field mappings based on templates', () => {
      cy.intercept('GET', '/api/templates/suggestions', {
        statusCode: 200,
        body: {
          suggestions: [
            {
              templateId: 'template_1',
              name: 'Employee Form',
              confidence: 0.95,
              matchedFields: ['firstName', 'lastName', 'email']
            },
            {
              templateId: 'template_2',
              name: 'Contact Form',
              confidence: 0.87,
              matchedFields: ['email', 'phone']
            }
          ]
        }
      }).as('getTemplateSuggestions')

      cy.get('[data-cy="template-suggestions-button"]').click()

      cy.wait('@getTemplateSuggestions')

      cy.get('[data-cy="template-suggestions"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="suggested-template"]').should('have.length', 2)
          
          cy.get('[data-cy="template-employee-form"]')
            .should('contain', 'Employee Form')
            .should('contain', '95%')
          
          cy.get('[data-cy="apply-template-button"]')
            .first()
            .click()
        })

      cy.get('[data-cy="template-applied-notification"]')
        .should('be.visible')
    })

    it('should validate required fields', () => {
      cy.get('[data-cy="field-email"]')
        .within(() => {
          cy.get('[data-cy="edit-field-button"]').click()
          cy.get('[data-cy="field-input"]').clear()
          cy.get('[data-cy="save-field-button"]').click()
        })

      cy.get('[data-cy="field-required-error"]')
        .should('be.visible')
        .should('contain', 'This field is required')

      cy.get('[data-cy="approve-document-button"]')
        .should('be.disabled')
    })
  })

  describe('Template Management', () => {
    beforeEach(() => {
      cy.visit('/templates')
    })

    it('should create new template from processed document', () => {
      cy.intercept('POST', '/api/templates', {
        statusCode: 201,
        body: {
          templateId: 'template_new',
          name: 'Custom Form Template',
          fields: ['name', 'email', 'phone']
        }
      }).as('createTemplate')

      cy.get('[data-cy="create-template-button"]').click()

      cy.get('[data-cy="template-name-input"]')
        .type('Custom Form Template')

      cy.get('[data-cy="template-description-input"]')
        .type('Template for processing custom forms')

      // Select source document
      cy.get('[data-cy="source-document-select"]')
        .click()
      cy.get('[data-value="doc_123"]').click()

      // Configure field mappings
      cy.get('[data-cy="field-mapping-section"]')
        .should('be.visible')

      cy.get('[data-cy="add-field-button"]').click()
      cy.get('[data-cy="field-name-input"]').type('name')
      cy.get('[data-cy="field-type-select"]').select('text')
      cy.get('[data-cy="field-required-checkbox"]').check()

      cy.get('[data-cy="save-template-button"]').click()

      cy.wait('@createTemplate')

      cy.get('[data-cy="template-created-notification"]')
        .should('be.visible')

      // Verify template appears in list
      cy.get('[data-cy="template-list"]')
        .should('contain', 'Custom Form Template')
    })

    it('should use existing template for processing', () => {
      cy.intercept('GET', '/api/templates', {
        statusCode: 200,
        body: {
          templates: [
            {
              templateId: 'template_1',
              name: 'Employee Form',
              fields: ['firstName', 'lastName', 'email', 'department']
            }
          ]
        }
      }).as('getTemplates')

      cy.wait('@getTemplates')

      cy.visit('/documents/upload')

      // Upload document
      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'employee-form.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      // Select template before processing
      cy.get('[data-cy="template-select"]')
        .should('be.visible')
        .click()
      
      cy.get('[data-value="template_1"]').click()

      cy.get('[data-cy="selected-template"]')
        .should('contain', 'Employee Form')

      cy.get('[data-cy="process-with-template-button"]').click()

      cy.get('[data-cy="template-processing-notification"]')
        .should('be.visible')
        .should('contain', 'Processing with Employee Form template')
    })
  })

  describe('Download and Export', () => {
    beforeEach(() => {
      cy.visit('/documents/doc_123/results')
    })

    it('should download processed document as PDF', () => {
      cy.intercept('GET', '/api/documents/doc_123/download?format=pdf', {
        statusCode: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename=processed-document.pdf'
        },
        body: 'PDF content here'
      }).as('downloadPDF')

      cy.get('[data-cy="download-options"]')
        .should('be.visible')

      cy.get('[data-cy="download-pdf-button"]').click()

      cy.wait('@downloadPDF')

      // Verify download started
      cy.get('[data-cy="download-started-notification"]')
        .should('be.visible')
    })

    it('should export data as JSON', () => {
      cy.intercept('GET', '/api/documents/doc_123/export?format=json', {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
          'content-disposition': 'attachment; filename=document-data.json'
        },
        body: {
          documentId: 'doc_123',
          extractedFields: {
            name: 'John Doe',
            email: 'john@example.com'
          }
        }
      }).as('exportJSON')

      cy.get('[data-cy="export-json-button"]').click()

      cy.wait('@exportJSON')

      cy.get('[data-cy="export-success-notification"]')
        .should('be.visible')
    })

    it('should export data as CSV', () => {
      cy.intercept('GET', '/api/documents/doc_123/export?format=csv', {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename=document-data.csv'
        },
        body: 'name,email\nJohn Doe,john@example.com'
      }).as('exportCSV')

      cy.get('[data-cy="export-csv-button"]').click()

      cy.wait('@exportCSV')

      cy.get('[data-cy="export-success-notification"]')
        .should('be.visible')
    })
  })

  describe('Credit Consumption Tracking', () => {
    it('should display credit cost before processing', () => {
      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="processing-cost"]')
        .should('be.visible')
        .should('contain', 'This will consume')
        .should('contain', 'credits')

      cy.get('[data-cy="current-credits"]')
        .should('be.visible')
    })

    it('should prevent processing when insufficient credits', () => {
      // Mock low credits scenario
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: { available: 2, required: 5 }
      }).as('checkCredits')

      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'large-document.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.wait('@checkCredits')

      cy.get('[data-cy="insufficient-credits-warning"]')
        .should('be.visible')
        .should('contain', 'Insufficient credits')

      cy.get('[data-cy="start-processing-button"]')
        .should('be.disabled')

      cy.get('[data-cy="purchase-credits-button"]')
        .should('be.visible')
    })

    it('should deduct credits after successful processing', () => {
      cy.intercept('POST', '/api/documents/doc_123/process', {
        statusCode: 200,
        body: { jobId: 'job_456', creditsDeducted: 3 }
      }).as('processDocument')

      cy.visit('/documents/doc_123')
      cy.get('[data-cy="start-processing-button"]').click()

      cy.wait('@processDocument')

      cy.get('[data-cy="credits-deducted-notification"]')
        .should('be.visible')
        .should('contain', '3 credits deducted')

      // Credits should be updated in UI
      cy.get('[data-cy="current-credits"]')
        .should('not.contain', '100') // Should be less than initial amount
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle corrupted document files', () => {
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 400,
        body: { error: 'Corrupted file detected' }
      }).as('corruptedFile')

      cy.get('[data-cy="file-input"]').selectFile(
        'cypress/fixtures/corrupted.pdf',
        { force: true }
      )

      cy.wait('@corruptedFile')

      cy.get('[data-cy="file-corruption-error"]')
        .should('be.visible')
        .should('contain', 'File appears to be corrupted')
    })

    it('should handle processing timeout', () => {
      cy.intercept('GET', '/api/jobs/job_456/status', {
        statusCode: 408,
        body: { error: 'Processing timeout' }
      }).as('processingTimeout')

      cy.visit('/documents/doc_123')
      cy.get('[data-cy="start-processing-button"]').click()

      cy.wait('@processingTimeout')

      cy.get('[data-cy="timeout-error"]')
        .should('be.visible')
        .should('contain', 'Processing timed out')

      cy.get('[data-cy="retry-processing-button"]')
        .should('be.visible')
    })

    it('should handle unsupported document content', () => {
      cy.intercept('POST', '/api/documents/doc_123/process', {
        statusCode: 422,
        body: { error: 'Document content not supported for processing' }
      }).as('unsupportedContent')

      cy.visit('/documents/doc_123')
      cy.get('[data-cy="start-processing-button"]').click()

      cy.wait('@unsupportedContent')

      cy.get('[data-cy="unsupported-content-error"]')
        .should('be.visible')
        .should('contain', 'Document content not supported')

      cy.get('[data-cy="manual-processing-option"]')
        .should('be.visible')
    })
  })
})