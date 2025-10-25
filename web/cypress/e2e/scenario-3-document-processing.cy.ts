/// <reference types="cypress" />

/**
 * Scenario 3: Document Processing Workflow
 * Tests complete document upload, processing, and field extraction
 */

describe('Scenario 3: Document Processing Workflow', () => {
  const testUser = {
    email: 'processor@techstart.com',
    password: 'SecurePass123!',
    companySlug: 'techstart-2024',
    companyName: 'TechStart Inc'
  }

  beforeEach(() => {
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
    
    // Set authenticated session
    cy.window().then((win) => {
      win.localStorage.setItem('intellifill-auth', JSON.stringify({
        state: {
          user: {
            id: 'user-123',
            email: testUser.email,
            name: 'Document Processor',
            role: 'user'
          },
          company: {
            id: 'company-123',
            name: testUser.companyName,
            slug: testUser.companySlug,
            tier: 'professional',
            creditsRemaining: 500
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

  describe('Document Upload', () => {
    it('should display upload interface', () => {
      cy.visit('/upload')
      
      // Check for upload elements
      cy.contains('Upload Document').should('be.visible')
      cy.contains(/drag.*drop|browse/i).should('be.visible')
    })

    it('should show supported file types', () => {
      cy.visit('/upload')
      
      // Look for file type indicators
      cy.contains(/pdf|docx|csv/i).should('be.visible')
    })

    it('should handle file selection via button', () => {
      cy.visit('/upload')
      
      // Mock file upload
      cy.intercept('POST', '**/api/documents/upload', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            documentId: 'doc-123',
            fileName: 'invoice.pdf',
            fileSize: 1024576,
            status: 'uploaded',
            uploadedAt: new Date().toISOString()
          }
        }
      }).as('uploadFile')

      // Select file
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf'
      }, { force: true })

      // Wait for upload
      cy.wait('@uploadFile')
      
      // Check for success
      cy.contains('invoice.pdf').should('be.visible')
    })

    it('should show upload progress', () => {
      cy.visit('/upload')
      
      // Mock slow upload
      cy.intercept('POST', '**/api/documents/upload', (req) => {
        req.reply({
          delay: 2000,
          statusCode: 200,
          body: { success: true, data: { documentId: 'doc-123' } }
        })
      }).as('slowUpload')

      // Upload file
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'document.pdf',
        mimeType: 'application/pdf'
      }, { force: true })

      // Check for progress indicator
      cy.contains(/uploading|progress/i).should('be.visible')
    })

    it('should validate file size limits', () => {
      cy.visit('/upload')
      
      // Mock size error
      cy.intercept('POST', '**/api/documents/upload', {
        statusCode: 413,
        body: {
          error: 'File too large. Maximum size is 10MB'
        }
      }).as('largeFile')

      // Try large file
      const largeContent = 'x'.repeat(11 * 1024 * 1024) // 11MB
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from(largeContent),
        fileName: 'large.pdf',
        mimeType: 'application/pdf'
      }, { force: true })

      cy.wait('@largeFile')
      
      // Check error
      cy.contains(/too large|10MB/i).should('be.visible')
    })

    it('should reject unsupported file types', () => {
      cy.visit('/upload')
      
      // Try unsupported file
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('EXE content'),
        fileName: 'malware.exe',
        mimeType: 'application/x-msdownload'
      }, { force: true })

      // Check for error
      cy.contains(/unsupported|not allowed/i).should('be.visible')
    })
  })

  describe('Document Processing', () => {
    beforeEach(() => {
      // Mock successful upload first
      cy.intercept('POST', '**/api/documents/upload', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            documentId: 'doc-456',
            fileName: 'form.pdf',
            status: 'uploaded'
          }
        }
      }).as('upload')
    })

    it('should initiate processing after upload', () => {
      cy.visit('/upload')
      
      // Mock processing endpoint
      cy.intercept('POST', '**/api/documents/*/process', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            jobId: 'job-123',
            status: 'processing',
            estimatedTime: 30
          }
        }
      }).as('startProcess')

      // Upload file
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'form.pdf',
        mimeType: 'application/pdf'
      }, { force: true })

      cy.wait('@upload')
      
      // Start processing
      cy.contains('button', /process|extract/i).click()
      cy.wait('@startProcess')
      
      // Check processing started
      cy.contains(/processing|extracting/i).should('be.visible')
    })

    it('should show processing status updates', () => {
      cy.visit('/upload')
      
      // Mock status polling
      let statusCount = 0
      cy.intercept('GET', '**/api/jobs/*/status', (req) => {
        statusCount++
        const statuses = [
          { status: 'processing', progress: 25 },
          { status: 'processing', progress: 50 },
          { status: 'processing', progress: 75 },
          { status: 'completed', progress: 100 }
        ]
        req.reply({
          statusCode: 200,
          body: statuses[Math.min(statusCount - 1, 3)]
        })
      }).as('statusCheck')

      // Upload and process
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'form.pdf',
        mimeType: 'application/pdf'
      }, { force: true })

      cy.wait('@upload')
      cy.contains('button', /process/i).click()
      
      // Check for progress updates
      cy.wait('@statusCheck')
      cy.contains(/25%|50%|75%|100%|processing/i).should('be.visible')
    })

    it('should display extracted fields', () => {
      cy.visit('/upload')
      
      // Mock successful extraction
      cy.intercept('POST', '**/api/documents/*/process', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            jobId: 'job-789',
            status: 'completed',
            extractedFields: {
              companyName: 'ABC Corp',
              invoiceNumber: 'INV-2024-001',
              date: '2024-01-15',
              totalAmount: '$1,500.00',
              items: [
                { description: 'Service A', amount: '$1000.00' },
                { description: 'Service B', amount: '$500.00' }
              ]
            }
          }
        }
      }).as('processComplete')

      // Upload and process
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf'
      }, { force: true })

      cy.wait('@upload')
      cy.contains('button', /process/i).click()
      cy.wait('@processComplete')
      
      // Check extracted data
      cy.contains('ABC Corp').should('be.visible')
      cy.contains('INV-2024-001').should('be.visible')
      cy.contains('$1,500.00').should('be.visible')
    })

    it('should allow field editing', () => {
      // Mock completed processing
      cy.visit('/documents/doc-789/review')
      
      cy.intercept('GET', '**/api/documents/doc-789', {
        statusCode: 200,
        body: {
          extractedFields: {
            companyName: 'ABC Corp',
            invoiceNumber: 'INV-2024-001'
          }
        }
      }).as('getDocument')

      cy.wait('@getDocument')
      
      // Edit field
      cy.get('input[value="ABC Corp"]').clear().type('XYZ Corp')
      
      // Save changes
      cy.intercept('PUT', '**/api/documents/doc-789', {
        statusCode: 200,
        body: { success: true }
      }).as('saveChanges')
      
      cy.contains('button', /save|update/i).click()
      cy.wait('@saveChanges')
      
      // Check saved
      cy.contains(/saved|updated/i).should('be.visible')
    })
  })

  describe('Field Mapping', () => {
    it('should show confidence scores', () => {
      cy.visit('/documents/doc-123/review')
      
      cy.intercept('GET', '**/api/documents/doc-123', {
        statusCode: 200,
        body: {
          extractedFields: {
            companyName: { value: 'ABC Corp', confidence: 0.95 },
            invoiceNumber: { value: 'INV-001', confidence: 0.88 },
            date: { value: '2024-01-15', confidence: 0.72 }
          }
        }
      }).as('getDocWithConfidence')

      cy.wait('@getDocWithConfidence')
      
      // Check for confidence indicators
      cy.contains(/95%|high confidence/i).should('be.visible')
      cy.contains(/88%|medium confidence/i).should('be.visible')
      cy.contains(/72%|low confidence/i).should('be.visible')
    })

    it('should highlight low confidence fields', () => {
      cy.visit('/documents/doc-123/review')
      
      cy.intercept('GET', '**/api/documents/doc-123', {
        statusCode: 200,
        body: {
          extractedFields: {
            amount: { value: '$1,000', confidence: 0.45 }
          }
        }
      }).as('getLowConfidence')

      cy.wait('@getLowConfidence')
      
      // Low confidence fields should be highlighted
      cy.get('.field-low-confidence').should('exist')
      cy.contains(/review|verify/i).should('be.visible')
    })

    it('should support manual field mapping', () => {
      cy.visit('/documents/doc-123/review')
      
      // Add new field
      cy.contains('button', /add field/i).click()
      
      // Fill field details
      cy.get('input[placeholder*="field name"]').type('Customer ID')
      cy.get('input[placeholder*="value"]').type('CUST-001')
      
      // Save
      cy.contains('button', /add|save/i).click()
      
      // Verify added
      cy.contains('Customer ID').should('be.visible')
      cy.contains('CUST-001').should('be.visible')
    })
  })

  describe('Export and Download', () => {
    it('should export to different formats', () => {
      cy.visit('/documents/doc-123/export')
      
      // Check export options
      cy.contains('CSV').should('be.visible')
      cy.contains('JSON').should('be.visible')
      cy.contains('Excel').should('be.visible')
      
      // Export as CSV
      cy.intercept('GET', '**/api/documents/doc-123/export?format=csv', {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename="export.csv"'
        },
        body: 'field,value\ncompany,ABC Corp'
      }).as('exportCSV')
      
      cy.contains('button', 'CSV').click()
      cy.wait('@exportCSV')
    })

    it('should download original document', () => {
      cy.visit('/documents/doc-123/review')
      
      cy.intercept('GET', '**/api/documents/doc-123/download', {
        statusCode: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="original.pdf"'
        },
        body: 'PDF content'
      }).as('downloadOriginal')
      
      cy.contains(/download original/i).click()
      cy.wait('@downloadOriginal')
    })
  })

  describe('Processing History', () => {
    it('should show document history', () => {
      cy.visit('/history')
      
      cy.intercept('GET', '**/api/documents/history', {
        statusCode: 200,
        body: {
          documents: [
            {
              id: 'doc-1',
              fileName: 'invoice1.pdf',
              processedAt: '2024-01-15T10:00:00Z',
              status: 'completed'
            },
            {
              id: 'doc-2',
              fileName: 'form2.pdf',
              processedAt: '2024-01-14T15:30:00Z',
              status: 'completed'
            },
            {
              id: 'doc-3',
              fileName: 'report.pdf',
              processedAt: '2024-01-14T09:00:00Z',
              status: 'failed'
            }
          ]
        }
      }).as('getHistory')
      
      cy.wait('@getHistory')
      
      // Check history items
      cy.contains('invoice1.pdf').should('be.visible')
      cy.contains('form2.pdf').should('be.visible')
      cy.contains('report.pdf').should('be.visible')
      
      // Check status indicators
      cy.get('.status-completed').should('have.length', 2)
      cy.get('.status-failed').should('have.length', 1)
    })

    it('should filter history by status', () => {
      cy.visit('/history')
      
      // Filter by completed
      cy.get('select[name="status"]').select('completed')
      
      // Only completed should show
      cy.get('.status-completed').should('be.visible')
      cy.get('.status-failed').should('not.exist')
    })

    it('should search history', () => {
      cy.visit('/history')
      
      // Search for specific document
      cy.get('input[type="search"]').type('invoice')
      
      // Should filter results
      cy.contains('invoice1.pdf').should('be.visible')
      cy.contains('form2.pdf').should('not.exist')
    })
  })

  describe('Batch Processing', () => {
    it('should handle multiple file uploads', () => {
      cy.visit('/upload')
      
      // Select multiple files
      cy.get('input[type="file"]').selectFile([
        {
          contents: Cypress.Buffer.from('PDF 1'),
          fileName: 'doc1.pdf',
          mimeType: 'application/pdf'
        },
        {
          contents: Cypress.Buffer.from('PDF 2'),
          fileName: 'doc2.pdf',
          mimeType: 'application/pdf'
        },
        {
          contents: Cypress.Buffer.from('PDF 3'),
          fileName: 'doc3.pdf',
          mimeType: 'application/pdf'
        }
      ], { force: true })
      
      // Check all files listed
      cy.contains('doc1.pdf').should('be.visible')
      cy.contains('doc2.pdf').should('be.visible')
      cy.contains('doc3.pdf').should('be.visible')
      
      // Should show batch count
      cy.contains('3 files').should('be.visible')
    })

    it('should process batch with progress', () => {
      cy.visit('/upload')
      
      // Upload multiple files
      cy.get('input[type="file"]').selectFile([
        {
          contents: Cypress.Buffer.from('PDF 1'),
          fileName: 'batch1.pdf',
          mimeType: 'application/pdf'
        },
        {
          contents: Cypress.Buffer.from('PDF 2'),
          fileName: 'batch2.pdf',
          mimeType: 'application/pdf'
        }
      ], { force: true })
      
      // Mock batch processing
      cy.intercept('POST', '**/api/documents/batch/process', {
        statusCode: 200,
        body: {
          batchId: 'batch-123',
          totalFiles: 2,
          status: 'processing'
        }
      }).as('batchProcess')
      
      // Start batch processing
      cy.contains('button', /process all/i).click()
      cy.wait('@batchProcess')
      
      // Check batch progress
      cy.contains(/processing.*2.*files/i).should('be.visible')
    })
  })

  describe('Error Recovery', () => {
    it('should handle processing failures', () => {
      cy.visit('/upload')
      
      // Mock processing failure
      cy.intercept('POST', '**/api/documents/*/process', {
        statusCode: 500,
        body: {
          error: 'Processing failed: Unable to extract text'
        }
      }).as('processFailed')
      
      // Upload and try to process
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('Corrupted PDF'),
        fileName: 'corrupted.pdf',
        mimeType: 'application/pdf'
      }, { force: true })
      
      cy.contains('button', /process/i).click()
      cy.wait('@processFailed')
      
      // Should show error
      cy.contains(/failed|unable to extract/i).should('be.visible')
      
      // Should offer retry
      cy.contains('button', /retry/i).should('be.visible')
    })

    it('should fallback to OCR for scanned documents', () => {
      cy.visit('/upload')
      
      // Mock OCR processing
      cy.intercept('POST', '**/api/documents/*/process', {
        statusCode: 200,
        body: {
          processingMethod: 'OCR',
          message: 'Document appears to be scanned. Using OCR...'
        }
      }).as('ocrProcess')
      
      // Upload scanned document
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('Scanned PDF'),
        fileName: 'scanned.pdf',
        mimeType: 'application/pdf'
      }, { force: true })
      
      cy.contains('button', /process/i).click()
      cy.wait('@ocrProcess')
      
      // Should indicate OCR usage
      cy.contains(/OCR|optical character/i).should('be.visible')
    })
  })
})