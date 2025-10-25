/// <reference types="cypress" />

/**
 * Credit Management E2E Tests
 * 
 * Tests the complete credit system including:
 * - Credit balance monitoring and display
 * - Credit consumption tracking per operation
 * - Low credit warnings and notifications
 * - Credit purchase and upgrade flows
 * - Usage analytics and reporting
 * - Credit expiry handling
 * - Plan limitations and restrictions
 */

describe('Credit Management', () => {
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
  })

  afterEach(() => {
    cy.clearAuth()
  })

  describe('Credit Balance Display', () => {
    beforeEach(() => {
      cy.visit('/dashboard')
    })

    it('should display current credit balance prominently', () => {
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: {
          available: 85,
          total: 100,
          used: 15,
          type: 'trial',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          plan: 'trial'
        }
      }).as('getCredits')

      cy.wait('@getCredits')

      cy.get('[data-cy="credits-widget"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="current-credits"]')
            .should('contain', '85')
            .should('be.visible')

          cy.get('[data-cy="total-credits"]')
            .should('contain', '100')

          cy.get('[data-cy="used-credits"]')
            .should('contain', '15')

          cy.get('[data-cy="credit-type"]')
            .should('contain', 'Trial')

          cy.get('[data-cy="credit-expiry"]')
            .should('be.visible')
            .should('contain', 'expires in')
        })

      // Verify credit usage percentage
      cy.get('[data-cy="credit-usage-bar"]')
        .should('be.visible')
        .should('have.attr', 'value', '15')
        .should('have.attr', 'max', '100')
    })

    it('should show credit breakdown by operation type', () => {
      cy.get('[data-cy="credits-widget"]').click()

      cy.get('[data-cy="credit-breakdown-modal"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="breakdown-item"]')
            .should('have.length.greaterThan', 0)

          cy.get('[data-cy="pdf-processing-usage"]')
            .should('be.visible')
            .should('contain', 'PDF Processing')

          cy.get('[data-cy="ocr-usage"]')
            .should('be.visible')
            .should('contain', 'OCR Processing')

          cy.get('[data-cy="ai-field-extraction-usage"]')
            .should('be.visible')
            .should('contain', 'AI Field Extraction')
        })
    })

    it('should display real-time credit updates', () => {
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: {
          available: 85,
          total: 100,
          used: 15
        }
      }).as('initialCredits')

      cy.wait('@initialCredits')

      // Mock processing that consumes credits
      cy.intercept('POST', '/api/documents/process', {
        statusCode: 200,
        body: {
          jobId: 'job_123',
          creditsDeducted: 3,
          remainingCredits: 82
        }
      }).as('processDocument')

      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: {
          available: 82,
          total: 100,
          used: 18
        }
      }).as('updatedCredits')

      cy.visit('/documents/upload')
      
      // Upload and process document
      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="start-processing-button"]').click()
      cy.wait('@processDocument')

      // Credits should update in real-time
      cy.get('[data-cy="current-credits"]')
        .should('contain', '82')

      cy.get('[data-cy="credits-deducted-notification"]')
        .should('be.visible')
        .should('contain', '3 credits deducted')
    })
  })

  describe('Credit Consumption Tracking', () => {
    it('should show credit cost before operations', () => {
      cy.visit('/documents/upload')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="processing-cost-display"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="base-cost"]')
            .should('contain', 'Base processing: 2 credits')

          cy.get('[data-cy="ocr-cost"]')
            .should('contain', 'OCR processing: 1 credit')

          cy.get('[data-cy="ai-extraction-cost"]')
            .should('contain', 'AI extraction: 2 credits')

          cy.get('[data-cy="total-cost"]')
            .should('contain', 'Total: 5 credits')
        })

      cy.get('[data-cy="remaining-after-operation"]')
        .should('be.visible')
        .should('contain', 'Remaining after: 80 credits')
    })

    it('should track credit usage history', () => {
      cy.intercept('GET', '/api/user/credit-history', {
        statusCode: 200,
        body: {
          history: [
            {
              id: 'usage_1',
              operation: 'document_processing',
              document: 'employee-form.pdf',
              credits: -3,
              timestamp: new Date().toISOString(),
              details: 'PDF processing + AI extraction'
            },
            {
              id: 'usage_2',
              operation: 'ocr_processing',
              document: 'scanned-doc.jpg',
              credits: -2,
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              details: 'OCR text extraction'
            },
            {
              id: 'purchase_1',
              operation: 'credit_purchase',
              credits: +100,
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              details: 'Pro plan upgrade'
            }
          ]
        }
      }).as('getCreditHistory')

      cy.visit('/settings/credits')

      cy.wait('@getCreditHistory')

      cy.get('[data-cy="credit-history"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="history-item"]').should('have.length', 3)

          // Check deduction entry
          cy.get('[data-cy="history-item"]')
            .first()
            .within(() => {
              cy.get('[data-cy="operation-type"]')
                .should('contain', 'Document Processing')
              cy.get('[data-cy="credit-change"]')
                .should('contain', '-3')
                .should('have.class', 'credit-deduction')
              cy.get('[data-cy="document-name"]')
                .should('contain', 'employee-form.pdf')
            })

          // Check credit addition entry
          cy.get('[data-cy="history-item"]')
            .last()
            .within(() => {
              cy.get('[data-cy="operation-type"]')
                .should('contain', 'Credit Purchase')
              cy.get('[data-cy="credit-change"]')
                .should('contain', '+100')
                .should('have.class', 'credit-addition')
            })
        })
    })

    it('should export credit usage report', () => {
      cy.intercept('GET', '/api/user/credit-history/export', {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename=credit-usage.csv'
        },
        body: 'date,operation,credits,document\n2024-01-01,processing,-3,doc.pdf'
      }).as('exportCreditHistory')

      cy.visit('/settings/credits')

      cy.get('[data-cy="export-usage-button"]').click()

      cy.get('[data-cy="export-modal"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="export-format-select"]').select('csv')
          cy.get('[data-cy="date-range-start"]').type('2024-01-01')
          cy.get('[data-cy="date-range-end"]').type('2024-01-31')
          cy.get('[data-cy="confirm-export-button"]').click()
        })

      cy.wait('@exportCreditHistory')

      cy.get('[data-cy="export-success-notification"]')
        .should('be.visible')
    })
  })

  describe('Low Credit Warnings', () => {
    it('should show warning when credits are running low', () => {
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: {
          available: 5,
          total: 100,
          used: 95,
          warningThreshold: 10
        }
      }).as('getLowCredits')

      cy.visit('/dashboard')
      cy.wait('@getLowCredits')

      cy.get('[data-cy="low-credits-warning"]')
        .should('be.visible')
        .should('contain', 'Low Credits Warning')
        .should('contain', 'Only 5 credits remaining')

      cy.get('[data-cy="warning-icon"]')
        .should('be.visible')
        .should('have.class', 'text-orange-500')

      cy.get('[data-cy="purchase-credits-button"]')
        .should('be.visible')
    })

    it('should prevent operations when credits are insufficient', () => {
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: {
          available: 2,
          total: 100,
          used: 98
        }
      }).as('getInsufficientCredits')

      cy.visit('/documents/upload')
      cy.wait('@getInsufficientCredits')

      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="insufficient-credits-error"]')
        .should('be.visible')
        .should('contain', 'Insufficient credits')
        .should('contain', 'This operation requires 5 credits')

      cy.get('[data-cy="start-processing-button"]')
        .should('be.disabled')

      cy.get('[data-cy="upgrade-plan-button"]')
        .should('be.visible')
    })

    it('should show critical warning at 0 credits', () => {
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: {
          available: 0,
          total: 100,
          used: 100
        }
      }).as('getZeroCredits')

      cy.visit('/dashboard')
      cy.wait('@getZeroCredits')

      cy.get('[data-cy="zero-credits-banner"]')
        .should('be.visible')
        .should('contain', 'No Credits Remaining')
        .should('have.class', 'bg-red-100')

      cy.get('[data-cy="critical-warning-icon"]')
        .should('be.visible')
        .should('have.class', 'text-red-500')

      // All processing should be disabled
      cy.visit('/documents/upload')

      cy.get('[data-cy="upload-disabled-overlay"]')
        .should('be.visible')
        .should('contain', 'Upload disabled - no credits')
    })

    it('should configure warning thresholds', () => {
      cy.visit('/settings/credits')

      cy.get('[data-cy="warning-settings"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="low-credit-threshold"]')
            .clear()
            .type('15')

          cy.get('[data-cy="critical-threshold"]')
            .clear()
            .type('5')

          cy.get('[data-cy="email-notifications"]').check()
          cy.get('[data-cy="browser-notifications"]').check()
        })

      cy.get('[data-cy="save-warning-settings"]').click()

      cy.get('[data-cy="settings-saved-notification"]')
        .should('be.visible')
    })
  })

  describe('Credit Purchase Flow', () => {
    beforeEach(() => {
      cy.visit('/pricing')
    })

    it('should display available credit packages', () => {
      cy.intercept('GET', '/api/pricing/packages', {
        statusCode: 200,
        body: {
          packages: [
            {
              id: 'starter',
              name: 'Starter Pack',
              credits: 100,
              price: 19.99,
              pricePerCredit: 0.20,
              features: ['Basic processing', '30-day expiry']
            },
            {
              id: 'professional',
              name: 'Professional Pack',
              credits: 500,
              price: 79.99,
              pricePerCredit: 0.16,
              features: ['Advanced processing', '60-day expiry', 'Priority support']
            },
            {
              id: 'enterprise',
              name: 'Enterprise Pack',
              credits: 2000,
              price: 299.99,
              pricePerCredit: 0.15,
              features: ['Premium processing', '90-day expiry', 'Dedicated support']
            }
          ]
        }
      }).as('getPricingPackages')

      cy.wait('@getPricingPackages')

      cy.get('[data-cy="pricing-packages"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="package-card"]').should('have.length', 3)

          cy.get('[data-cy="package-starter"]')
            .should('contain', 'Starter Pack')
            .should('contain', '100 credits')
            .should('contain', '$19.99')
            .should('contain', '$0.20 per credit')

          cy.get('[data-cy="package-professional"]')
            .should('contain', 'Professional Pack')
            .should('contain', '500 credits')
            .should('contain', '$79.99')
            .should('contain', '$0.16 per credit')
        })
    })

    it('should complete credit purchase flow', () => {
      cy.intercept('POST', '/api/purchases/create-session', {
        statusCode: 200,
        body: {
          sessionId: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123'
        }
      }).as('createCheckoutSession')

      cy.intercept('GET', '/api/purchases/session/cs_test_123/status', {
        statusCode: 200,
        body: {
          status: 'complete',
          paymentStatus: 'paid',
          credits: 500
        }
      }).as('checkPaymentStatus')

      cy.get('[data-cy="package-professional"]')
        .within(() => {
          cy.get('[data-cy="select-package-button"]').click()
        })

      cy.get('[data-cy="purchase-confirmation-modal"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="package-summary"]')
            .should('contain', 'Professional Pack')
            .should('contain', '500 credits')
            .should('contain', '$79.99')

          cy.get('[data-cy="current-credits"]')
            .should('be.visible')

          cy.get('[data-cy="credits-after-purchase"]')
            .should('contain', 'Total after purchase')

          cy.get('[data-cy="confirm-purchase-button"]').click()
        })

      cy.wait('@createCheckoutSession')

      // Mock Stripe checkout completion
      cy.window().then((win) => {
        // Simulate return from Stripe
        win.location.href = '/purchase/success?session_id=cs_test_123'
      })

      cy.wait('@checkPaymentStatus')

      cy.get('[data-cy="purchase-success"]')
        .should('be.visible')
        .should('contain', 'Purchase successful!')
        .should('contain', '500 credits added')

      // Credits should be updated
      cy.get('[data-cy="updated-credit-balance"]')
        .should('be.visible')
    })

    it('should handle payment failures gracefully', () => {
      cy.intercept('GET', '/api/purchases/session/cs_test_failed/status', {
        statusCode: 200,
        body: {
          status: 'open',
          paymentStatus: 'failed'
        }
      }).as('checkFailedPayment')

      cy.visit('/purchase/failed?session_id=cs_test_failed')

      cy.wait('@checkFailedPayment')

      cy.get('[data-cy="payment-failed"]')
        .should('be.visible')
        .should('contain', 'Payment failed')

      cy.get('[data-cy="retry-payment-button"]')
        .should('be.visible')

      cy.get('[data-cy="contact-support-button"]')
        .should('be.visible')
    })

    it('should display payment methods and security', () => {
      cy.get('[data-cy="payment-security"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="ssl-badge"]').should('be.visible')
          cy.get('[data-cy="stripe-badge"]').should('be.visible')
          cy.get('[data-cy="security-text"]')
            .should('contain', 'Secure payments powered by Stripe')
        })

      cy.get('[data-cy="accepted-cards"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="visa-icon"]').should('be.visible')
          cy.get('[data-cy="mastercard-icon"]').should('be.visible')
          cy.get('[data-cy="amex-icon"]').should('be.visible')
        })
    })
  })

  describe('Plan Upgrade Flow', () => {
    it('should suggest plan upgrade for high usage users', () => {
      cy.intercept('GET', '/api/user/usage-analysis', {
        statusCode: 200,
        body: {
          avgMonthlyUsage: 450,
          currentPlan: 'trial',
          suggestedPlan: 'professional',
          potentialSavings: 25.99
        }
      }).as('getUsageAnalysis')

      cy.visit('/dashboard')
      cy.wait('@getUsageAnalysis')

      cy.get('[data-cy="upgrade-suggestion"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="current-plan"]').should('contain', 'Trial')
          cy.get('[data-cy="suggested-plan"]').should('contain', 'Professional')
          cy.get('[data-cy="potential-savings"]').should('contain', '$25.99')
          cy.get('[data-cy="view-plans-button"]').should('be.visible')
        })
    })

    it('should compare current plan with upgrade options', () => {
      cy.visit('/pricing/compare')

      cy.get('[data-cy="plan-comparison"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="current-plan-column"]')
            .should('contain', 'Current: Trial')
            .should('have.class', 'highlighted')

          cy.get('[data-cy="feature-comparison"]')
            .should('be.visible')

          cy.get('[data-cy="upgrade-benefits"]')
            .should('contain', 'More credits')
            .should('contain', 'Longer expiry')
            .should('contain', 'Priority support')
        })

      cy.get('[data-cy="upgrade-to-pro-button"]')
        .should('be.visible')
        .click()

      cy.url().should('include', '/pricing')
    })

    it('should handle plan downgrade restrictions', () => {
      // Login as user with pro plan
      cy.intercept('GET', '/api/user/subscription', {
        statusCode: 200,
        body: {
          plan: 'professional',
          credits: 450,
          features: ['advanced_processing', 'priority_support'],
          canDowngrade: false,
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      }).as('getSubscription')

      cy.visit('/settings/subscription')
      cy.wait('@getSubscription')

      cy.get('[data-cy="current-plan"]')
        .should('contain', 'Professional')

      cy.get('[data-cy="downgrade-option"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="downgrade-warning"]')
        .should('be.visible')
        .should('contain', 'You have unused credits')
        .should('contain', 'Downgrade will take effect at next billing cycle')

      cy.get('[data-cy="confirm-downgrade-button"]')
        .should('be.disabled')
    })
  })

  describe('Credit Expiry Management', () => {
    it('should display credit expiry information', () => {
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: {
          available: 75,
          expiringCredits: [
            {
              amount: 25,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              source: 'Trial credits'
            },
            {
              amount: 50,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              source: 'Starter pack purchase'
            }
          ]
        }
      }).as('getCreditsWithExpiry')

      cy.visit('/settings/credits')
      cy.wait('@getCreditsWithExpiry')

      cy.get('[data-cy="credit-expiry-section"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="expiring-credits-list"]')
            .should('be.visible')

          cy.get('[data-cy="expiring-batch"]')
            .first()
            .within(() => {
              cy.get('[data-cy="expiry-amount"]').should('contain', '25')
              cy.get('[data-cy="expiry-date"]').should('contain', 'expires in 7 days')
              cy.get('[data-cy="expiry-source"]').should('contain', 'Trial credits')
              cy.get('[data-cy="urgent-expiry"]').should('be.visible')
            })
        })
    })

    it('should send expiry warnings', () => {
      cy.intercept('GET', '/api/user/credits', {
        statusCode: 200,
        body: {
          available: 30,
          expiringCredits: [
            {
              amount: 30,
              expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              source: 'Trial credits'
            }
          ]
        }
      }).as('getExpiringCredits')

      cy.visit('/dashboard')
      cy.wait('@getExpiringCredits')

      cy.get('[data-cy="expiry-warning-banner"]')
        .should('be.visible')
        .should('contain', '30 credits expiring in 2 days')
        .should('have.class', 'bg-yellow-100')

      cy.get('[data-cy="extend-credits-button"]')
        .should('be.visible')
    })

    it('should handle expired credits cleanup', () => {
      cy.intercept('POST', '/api/user/credits/cleanup-expired', {
        statusCode: 200,
        body: {
          removedCredits: 15,
          remainingCredits: 85
        }
      }).as('cleanupExpiredCredits')

      cy.visit('/settings/credits')

      cy.get('[data-cy="cleanup-expired-button"]').click()

      cy.get('[data-cy="cleanup-confirmation"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="confirm-cleanup-button"]').click()
        })

      cy.wait('@cleanupExpiredCredits')

      cy.get('[data-cy="cleanup-success-notification"]')
        .should('be.visible')
        .should('contain', '15 expired credits removed')

      cy.get('[data-cy="current-credits"]')
        .should('contain', '85')
    })
  })

  describe('Usage Analytics and Insights', () => {
    beforeEach(() => {
      cy.visit('/analytics/credits')
    })

    it('should display credit usage analytics', () => {
      cy.intercept('GET', '/api/analytics/credit-usage', {
        statusCode: 200,
        body: {
          dailyUsage: [
            { date: '2024-01-01', credits: 15 },
            { date: '2024-01-02', credits: 12 },
            { date: '2024-01-03', credits: 18 }
          ],
          usageByOperation: {
            'PDF Processing': 45,
            'OCR Processing': 25,
            'AI Extraction': 30
          },
          averageDailyUsage: 12.5,
          projectedMonthlyUsage: 375
        }
      }).as('getCreditAnalytics')

      cy.wait('@getCreditAnalytics')

      cy.get('[data-cy="usage-chart"]')
        .should('be.visible')

      cy.get('[data-cy="usage-breakdown"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="operation-pdf"]')
            .should('contain', 'PDF Processing: 45%')
          cy.get('[data-cy="operation-ocr"]')
            .should('contain', 'OCR Processing: 25%')
          cy.get('[data-cy="operation-ai"]')
            .should('contain', 'AI Extraction: 30%')
        })

      cy.get('[data-cy="usage-insights"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="avg-daily-usage"]')
            .should('contain', '12.5 credits per day')
          cy.get('[data-cy="projected-monthly"]')
            .should('contain', '375 credits projected this month')
        })
    })

    it('should provide optimization recommendations', () => {
      cy.get('[data-cy="optimization-recommendations"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="recommendation-item"]')
            .should('have.length.greaterThan', 0)

          cy.get('[data-cy="recommendation"]')
            .first()
            .should('contain', 'Consider upgrading to Professional plan')
            .should('contain', 'Save 15% on credit costs')
        })
    })

    it('should filter analytics by date range', () => {
      cy.get('[data-cy="date-range-picker"]').click()

      cy.get('[data-cy="preset-last-7-days"]').click()

      cy.get('[data-cy="usage-chart"]')
        .should('be.visible')

      // Verify chart updates
      cy.get('[data-cy="chart-data-points"]')
        .should('have.length', 7)
    })
  })
})