/// <reference types="cypress" />

/**
 * Comprehensive Example Test
 * 
 * This test demonstrates the usage of all custom commands and fixtures
 * created for the QuikAdmin E2E testing suite. It serves as both a
 * comprehensive integration test and documentation for the testing framework.
 */

describe('Comprehensive QuikAdmin E2E Example', () => {
  let testCompany: any
  let adminUser: any
  let regularUser: any

  before(() => {
    // Setup test data using custom commands
    cy.createTestCompany('enterprise').then((company) => {
      testCompany = company
    })
    
    cy.createTestUser('admin', testCompany?.slug).then((user) => {
      adminUser = user
    })
    
    cy.createTestUser('user', testCompany?.slug).then((user) => {
      regularUser = user
    })
  })

  beforeEach(() => {
    cy.clearAuth()
    cy.setupApiMocks()
  })

  afterEach(() => {
    cy.clearAuth()
  })

  describe('Complete User Journey Example', () => {
    it('should demonstrate complete workflow from registration to document processing', () => {
      cy.measurePerformance('Complete User Journey')

      // 1. Company Registration
      cy.visit('/register')
      
      cy.get('[data-cy="register-company-button"]').click()
      
      // Use fixture data for form filling
      cy.fillFormFromFixture('[data-cy="company-form"]', {
        'company-name': testCompany.name,
        'company-slug': testCompany.slug,
        'company-domain': testCompany.domain,
        'company-industry': testCompany.industry,
        'admin-name': adminUser.name,
        'admin-email': adminUser.email,
        'admin-password': adminUser.password,
        'terms': true
      })

      cy.get('[data-cy="register-company-submit"]').click()

      // 2. Login and Dashboard Access
      cy.url().should('include', '/dashboard')
      cy.checkAuthState(true)

      // Check accessibility
      cy.checkAccessibility()

      // 3. Credit Management Verification
      cy.setupCreditScenario('sufficient')
      cy.visit('/dashboard')
      
      cy.get('[data-cy="credits-widget"]')
        .should('be.visible')
        .should('contain', 'Trial')

      // 4. Document Processing Workflow
      cy.visit('/documents/upload')
      
      // Test XSS prevention on upload form
      cy.testXSSPrevention('[data-cy="document-description"]')

      // Process document using workflow command
      cy.processDocumentWorkflow('sample.pdf')

      // 5. Team Management
      cy.visit('/team/members')
      
      cy.get('[data-cy="invite-member-button"]').click()
      
      cy.fillFormFromFixture('[data-cy="invitation-form"]', {
        'invite-email': regularUser.email,
        'invite-name': regularUser.name,
        'invite-role': regularUser.role
      })

      cy.get('[data-cy="send-invitation-button"]').click()
      cy.get('[data-cy="invitation-sent-notification"]').should('be.visible')

      // 6. Mobile Responsiveness Check
      cy.testMobileViewport('iphone-6')
      cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible')

      // 7. Performance and Error Handling
      cy.simulateNetworkCondition('slow')
      cy.visit('/documents')
      cy.get('[data-cy="slow-connection-warning"]').should('be.visible')

      cy.log('Complete user journey test completed successfully')
    })
  })

  describe('Advanced Testing Features Demonstration', () => {
    beforeEach(() => {
      cy.loginViaApi(adminUser)
    })

    it('should demonstrate API mocking capabilities', () => {
      // Mock specific API responses
      cy.mockApi({
        endpoint: '/api/analytics/usage',
        method: 'GET',
        response: {
          dailyUsage: [
            { date: '2024-01-01', credits: 15 },
            { date: '2024-01-02', credits: 22 }
          ]
        },
        statusCode: 200,
        delay: 1000
      })

      cy.visit('/analytics')
      cy.get('[data-cy="usage-chart"]').should('be.visible')
    })

    it('should demonstrate document upload variations', () => {
      cy.visit('/documents/upload')

      // Test successful upload
      cy.uploadDocumentAdvanced({
        fileName: 'sample.pdf',
        fileType: 'application/pdf',
        fileSize: 1024576
      })

      cy.get('[data-cy="upload-success"]').should('be.visible')

      // Test corrupted file handling
      cy.uploadDocumentAdvanced({
        fileName: 'corrupted.pdf',
        corrupted: true
      })

      cy.get('[data-cy="file-corruption-error"]').should('be.visible')
    })

    it('should demonstrate network condition testing', () => {
      // Test offline behavior
      cy.simulateNetworkCondition('offline')
      cy.visit('/documents')
      
      cy.get('[data-cy="offline-banner"]').should('be.visible')

      // Test unstable connection
      cy.simulateNetworkCondition('unstable')
      cy.reload()
      
      cy.get('[data-cy="connection-unstable-warning"]').should('be.visible')
    })

    it('should demonstrate accessibility testing', () => {
      cy.visit('/dashboard')
      
      // Check overall accessibility
      cy.checkAccessibility()

      // Check specific accessibility rules
      cy.checkAccessibility({
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true }
        }
      })
    })

    it('should demonstrate credit scenario testing', () => {
      // Test low credits scenario
      cy.setupCreditScenario('low')
      cy.visit('/dashboard')
      
      cy.get('[data-cy="low-credits-warning"]').should('be.visible')

      // Test insufficient credits scenario
      cy.setupCreditScenario('insufficient')
      cy.visit('/documents/upload')
      
      cy.uploadDocumentAdvanced({ fileName: 'sample.pdf' })
      cy.get('[data-cy="insufficient-credits-error"]').should('be.visible')
    })

    it('should demonstrate performance monitoring', () => {
      cy.measurePerformance('Dashboard Load')
      cy.visit('/dashboard')
      cy.waitForAllApiCalls()

      cy.measurePerformance('Document Upload')
      cy.visit('/documents/upload')
      cy.uploadDocumentAdvanced({ fileName: 'sample.pdf' })
    })
  })

  describe('Security Testing Examples', () => {
    beforeEach(() => {
      cy.loginViaApi(adminUser)
    })

    it('should demonstrate XSS prevention testing', () => {
      cy.visit('/team/invite')
      
      // Test XSS prevention on member name input
      cy.testXSSPrevention('[data-cy="member-name-input"]')
      
      // Test XSS prevention on description fields
      cy.testXSSPrevention('[data-cy="custom-message-textarea"]')
    })

    it('should demonstrate input validation testing', () => {
      cy.visit('/register')
      
      cy.fixture('test-scenarios').then((scenarios) => {
        // Test SQL injection payloads
        scenarios.securityTestData.sqlInjectionPayloads.forEach((payload: string) => {
          cy.get('[data-cy="email-input"]').clear().type(payload)
          cy.get('[data-cy="login-button"]').click()
          
          cy.get('[data-cy="invalid-input-error"]')
            .should('be.visible')
            .should('contain', 'Invalid email format')
        })
      })
    })

    it('should demonstrate file security testing', () => {
      cy.visit('/documents/upload')
      
      cy.fixture('test-scenarios').then((scenarios) => {
        scenarios.securityTestData.invalidFileTypes.forEach((fileTest: any) => {
          const maliciousFile = new File(['malicious content'], fileTest.fileName, {
            type: fileTest.disguisedAs
          })
          
          cy.get('[data-cy="file-input"]').selectFile(maliciousFile, { force: true })
          
          cy.get('[data-cy="security-warning"]')
            .should('be.visible')
            .should('contain', 'Security check failed')
        })
      })
    })
  })

  describe('Cross-Device and Responsive Testing', () => {
    beforeEach(() => {
      cy.loginViaApi(adminUser)
    })

    it('should demonstrate responsive layout testing', () => {
      cy.fixture('test-scenarios').then((scenarios) => {
        Object.entries(scenarios.mobileTestData.viewports).forEach(([device, viewport]) => {
          cy.viewport(viewport.width, viewport.height)
          cy.visit('/dashboard')
          
          // Verify layout adapts correctly
          if (viewport.width < 768) {
            cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible')
            cy.get('[data-cy="desktop-navigation"]').should('not.be.visible')
          } else {
            cy.get('[data-cy="desktop-navigation"]').should('be.visible')
          }
          
          cy.log(`Tested responsive layout on ${device}: ${viewport.width}x${viewport.height}`)
        })
      })
    })

    it('should demonstrate touch interaction testing', () => {
      cy.testMobileViewport('iphone-6')
      cy.visit('/documents/doc_123/review')

      // Test swipe gestures
      cy.get('[data-cy="document-viewer"]')
        .trigger('touchstart', { touches: [{ clientX: 300, clientY: 300 }] })
        .trigger('touchmove', { touches: [{ clientX: 100, clientY: 300 }] })
        .trigger('touchend')

      cy.get('[data-cy="page-indicator"]').should('contain', 'Page 2')
    })

    it('should demonstrate orientation change testing', () => {
      // Portrait mode
      cy.viewport(375, 667)
      cy.visit('/dashboard')
      cy.get('[data-cy="dashboard-content"]').should('be.visible')

      // Switch to landscape
      cy.viewport(667, 375)
      cy.get('[data-cy="dashboard-content"]').should('be.visible')
      
      // Verify layout adapts
      cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible')
    })
  })

  describe('Error Recovery and Edge Cases', () => {
    beforeEach(() => {
      cy.loginViaApi(adminUser)
    })

    it('should demonstrate error recovery testing', () => {
      cy.visit('/documents/upload')
      
      // Simulate upload failure then recovery
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 500,
        body: { error: 'Upload failed' }
      }).as('uploadFailure')

      cy.uploadDocumentAdvanced({ fileName: 'sample.pdf' })
      cy.wait('@uploadFailure')
      
      cy.get('[data-cy="upload-error"]').should('be.visible')
      cy.get('[data-cy="retry-upload-button"]').should('be.visible')

      // Simulate successful retry
      cy.intercept('POST', '/api/documents/upload', {
        statusCode: 200,
        body: { documentId: 'doc_123', status: 'uploaded' }
      }).as('uploadSuccess')

      cy.get('[data-cy="retry-upload-button"]').click()
      cy.wait('@uploadSuccess')
      
      cy.get('[data-cy="upload-success"]').should('be.visible')
    })

    it('should demonstrate session recovery', () => {
      cy.visit('/dashboard')
      
      // Simulate token expiry
      cy.intercept('GET', '/api/user/profile', {
        statusCode: 401,
        body: { error: 'Token expired' }
      }).as('tokenExpired')

      cy.get('[data-cy="refresh-data-button"]').click()
      cy.wait('@tokenExpired')

      cy.get('[data-cy="session-expired-modal"]').should('be.visible')
      cy.get('[data-cy="login-again-button"]').click()
      
      cy.url().should('include', '/login')
    })

    it('should demonstrate graceful degradation', () => {
      cy.visit('/documents/upload', {
        onBeforeLoad: (win) => {
          // Mock missing browser features
          delete win.File
          delete win.FileReader
        }
      })

      cy.get('[data-cy="browser-incompatible-warning"]')
        .should('be.visible')
        .should('contain', 'Browser not supported')

      cy.get('[data-cy="fallback-upload-option"]')
        .should('be.visible')
    })
  })

  describe('Integration Testing Examples', () => {
    it('should demonstrate end-to-end workflow integration', () => {
      // Complete workflow: Registration → Document Processing → Team Collaboration
      
      // 1. Company and user setup
      cy.createTestCompany('startup').then((company) => {
        cy.createTestUser('admin', company.slug).then((admin) => {
          
          // 2. Registration flow
          cy.visit('/register')
          cy.fillFormFromFixture('[data-cy="registration-form"]', {
            'company-name': company.name,
            'company-slug': company.slug,
            'admin-email': admin.email,
            'admin-password': admin.password
          })
          
          cy.get('[data-cy="register-button"]').click()
          cy.url().should('include', '/dashboard')
          
          // 3. Document processing
          cy.visit('/documents/upload')
          cy.processDocumentWorkflow('sample.pdf')
          
          // 4. Team collaboration
          cy.visit('/team/members')
          cy.createTestUser('user', company.slug).then((teamMember) => {
            cy.get('[data-cy="invite-member-button"]').click()
            cy.fillFormFromFixture('[data-cy="invite-form"]', {
              'member-email': teamMember.email,
              'member-name': teamMember.name,
              'member-role': teamMember.role
            })
            
            cy.get('[data-cy="send-invitation-button"]').click()
            cy.get('[data-cy="invitation-sent-notification"]').should('be.visible')
          })
          
          // 5. Verify complete workflow
          cy.get('[data-cy="team-member-list"]')
            .should('contain', admin.name)
            .should('contain', 'Pending invitation')
          
          cy.log('Complete integration workflow test passed')
        })
      })
    })
  })
})