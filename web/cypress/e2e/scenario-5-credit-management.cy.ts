/// <reference types="cypress" />

/**
 * Scenario 5: Credit Management
 * Tests credit usage, billing, and subscription management
 */

describe('Scenario 5: Credit Management', () => {
  const testCompany = {
    id: 'company-123',
    name: 'TechStart Inc',
    slug: 'techstart-2024',
    tier: 'professional',
    creditsRemaining: 500,
    creditLimit: 1000
  }

  const testUser = {
    id: 'user-123',
    email: 'billing@techstart.com',
    name: 'Billing Admin',
    role: 'admin'
  }

  beforeEach(() => {
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
    
    // Set authenticated session
    cy.window().then((win) => {
      win.localStorage.setItem('intellifill-auth', JSON.stringify({
        state: {
          user: testUser,
          company: testCompany,
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

  describe('Credit Display', () => {
    it('should display current credit balance', () => {
      cy.visit('/dashboard')
      
      // Check credit display
      cy.contains('500').should('be.visible')
      cy.contains(/credits.*remaining/i).should('be.visible')
      
      // Check credit bar/indicator
      cy.get('[data-cy="credit-indicator"]').should('be.visible')
    })

    it('should show credit usage percentage', () => {
      cy.visit('/dashboard')
      
      // 500/1000 = 50% used
      cy.contains('50%').should('be.visible')
      // OR
      cy.get('.credit-bar').should('have.css', 'width').and('match', /50/)
    })

    it('should display low credit warning', () => {
      // Set low credits
      cy.window().then((win) => {
        const authData = JSON.parse(win.localStorage.getItem('intellifill-auth') || '{}')
        authData.state.company.creditsRemaining = 50
        win.localStorage.setItem('intellifill-auth', JSON.stringify(authData))
      })
      
      cy.visit('/dashboard')
      
      // Check warning
      cy.contains(/low.*credits/i).should('be.visible')
      cy.get('.warning').should('be.visible')
    })

    it('should show critical credit alert', () => {
      // Set critical credits
      cy.window().then((win) => {
        const authData = JSON.parse(win.localStorage.getItem('intellifill-auth') || '{}')
        authData.state.company.creditsRemaining = 5
        win.localStorage.setItem('intellifill-auth', JSON.stringify(authData))
      })
      
      cy.visit('/dashboard')
      
      // Check critical alert
      cy.contains(/critical|urgent/i).should('be.visible')
      cy.get('.alert-critical').should('be.visible')
    })
  })

  describe('Credit Usage', () => {
    it('should deduct credits for document processing', () => {
      cy.visit('/upload')
      
      // Mock credit check before processing
      cy.intercept('GET', '**/api/credits/check', {
        statusCode: 200,
        body: {
          creditsAvailable: 500,
          costEstimate: 10,
          canProcess: true
        }
      }).as('checkCredits')
      
      // Mock processing with credit deduction
      cy.intercept('POST', '**/api/documents/process', {
        statusCode: 200,
        body: {
          success: true,
          creditsUsed: 10,
          creditsRemaining: 490
        }
      }).as('processDoc')
      
      // Upload and process
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'document.pdf',
        mimeType: 'application/pdf'
      }, { force: true })
      
      cy.contains('button', /process/i).click()
      
      cy.wait('@checkCredits')
      cy.wait('@processDoc')
      
      // Check updated balance
      cy.contains('490').should('be.visible')
      cy.contains('10 credits used').should('be.visible')
    })

    it('should prevent processing with insufficient credits', () => {
      // Set very low credits
      cy.window().then((win) => {
        const authData = JSON.parse(win.localStorage.getItem('intellifill-auth') || '{}')
        authData.state.company.creditsRemaining = 2
        win.localStorage.setItem('intellifill-auth', JSON.stringify(authData))
      })
      
      cy.visit('/upload')
      
      // Mock insufficient credits
      cy.intercept('GET', '**/api/credits/check', {
        statusCode: 402,
        body: {
          creditsAvailable: 2,
          costEstimate: 10,
          canProcess: false,
          error: 'Insufficient credits'
        }
      }).as('insufficientCredits')
      
      // Try to process
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'document.pdf',
        mimeType: 'application/pdf'
      }, { force: true })
      
      cy.contains('button', /process/i).click()
      cy.wait('@insufficientCredits')
      
      // Check error
      cy.contains(/insufficient.*credits/i).should('be.visible')
      cy.contains('button', /buy.*credits/i).should('be.visible')
    })

    it('should show credit cost estimate before processing', () => {
      cy.visit('/upload')
      
      // Upload file
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('PDF content'),
        fileName: 'large-document.pdf',
        mimeType: 'application/pdf'
      }, { force: true })
      
      // Mock cost estimate
      cy.intercept('POST', '**/api/credits/estimate', {
        statusCode: 200,
        body: {
          fileSize: 5242880, // 5MB
          pageCount: 50,
          estimatedCredits: 25,
          breakdown: {
            base: 10,
            pages: 10,
            ocr: 5
          }
        }
      }).as('creditEstimate')
      
      cy.wait('@creditEstimate')
      
      // Check estimate display
      cy.contains('Estimated cost: 25 credits').should('be.visible')
      cy.contains('50 pages').should('be.visible')
    })
  })

  describe('Credit History', () => {
    it('should display credit usage history', () => {
      cy.visit('/billing/history')
      
      // Mock usage history
      cy.intercept('GET', '**/api/credits/history', {
        statusCode: 200,
        body: {
          transactions: [
            {
              id: 'trans-1',
              type: 'debit',
              amount: -10,
              balance: 490,
              description: 'Document processing: invoice.pdf',
              timestamp: '2024-01-20T10:00:00Z'
            },
            {
              id: 'trans-2',
              type: 'credit',
              amount: 500,
              balance: 500,
              description: 'Monthly credit refill',
              timestamp: '2024-01-15T00:00:00Z'
            },
            {
              id: 'trans-3',
              type: 'debit',
              amount: -25,
              balance: 0,
              description: 'Batch processing: 5 documents',
              timestamp: '2024-01-14T15:00:00Z'
            }
          ]
        }
      }).as('getHistory')
      
      cy.wait('@getHistory')
      
      // Check history display
      cy.contains('invoice.pdf').should('be.visible')
      cy.contains('-10').should('be.visible')
      cy.contains('Monthly credit refill').should('be.visible')
      cy.contains('+500').should('be.visible')
    })

    it('should filter history by date range', () => {
      cy.visit('/billing/history')
      
      // Set date range
      cy.get('input[name="startDate"]').type('2024-01-15')
      cy.get('input[name="endDate"]').type('2024-01-20')
      
      // Apply filter
      cy.contains('button', /filter/i).click()
      
      // Check filtered results
      cy.contains('invoice.pdf').should('be.visible')
      cy.contains('Batch processing').should('not.exist')
    })

    it('should export usage history', () => {
      cy.visit('/billing/history')
      
      // Mock export
      cy.intercept('GET', '**/api/credits/history/export', {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename="credit-history.csv"'
        },
        body: 'Date,Description,Amount,Balance\n2024-01-20,Document processing,-10,490'
      }).as('exportHistory')
      
      cy.contains('button', /export/i).click()
      cy.wait('@exportHistory')
    })
  })

  describe('Subscription Management', () => {
    it('should display current plan details', () => {
      cy.visit('/billing/subscription')
      
      // Mock subscription details
      cy.intercept('GET', '**/api/subscription', {
        statusCode: 200,
        body: {
          plan: {
            name: 'Professional',
            tier: 'professional',
            price: '$99/month',
            credits: 1000,
            features: [
              'Advanced OCR',
              'API Access',
              'Priority Support',
              'Team Collaboration'
            ]
          },
          billing: {
            nextBillingDate: '2024-02-01',
            paymentMethod: '**** 1234',
            autoRenew: true
          }
        }
      }).as('getSubscription')
      
      cy.wait('@getSubscription')
      
      // Check plan display
      cy.contains('Professional').should('be.visible')
      cy.contains('$99/month').should('be.visible')
      cy.contains('1000 credits').should('be.visible')
      cy.contains('Advanced OCR').should('be.visible')
    })

    it('should show available plans for upgrade', () => {
      cy.visit('/billing/plans')
      
      // Mock available plans
      cy.intercept('GET', '**/api/plans', {
        statusCode: 200,
        body: {
          currentPlan: 'professional',
          plans: [
            {
              id: 'starter',
              name: 'Starter',
              price: '$29/month',
              credits: 250,
              features: ['Basic OCR', 'Email Support']
            },
            {
              id: 'professional',
              name: 'Professional',
              price: '$99/month',
              credits: 1000,
              features: ['Advanced OCR', 'API Access', 'Priority Support'],
              current: true
            },
            {
              id: 'enterprise',
              name: 'Enterprise',
              price: 'Custom',
              credits: 'Unlimited',
              features: ['Everything in Pro', 'Custom Integration', 'SLA']
            }
          ]
        }
      }).as('getPlans')
      
      cy.wait('@getPlans')
      
      // Check plans display
      cy.contains('Starter').should('be.visible')
      cy.contains('Professional').should('be.visible')
      cy.contains('Current Plan').should('be.visible')
      cy.contains('Enterprise').should('be.visible')
      
      // Upgrade button for enterprise
      cy.get('[data-plan="enterprise"]')
        .contains('button', /upgrade|contact/i)
        .should('be.visible')
    })

    it('should handle plan upgrade', () => {
      cy.visit('/billing/plans')
      
      // Mock upgrade process
      cy.intercept('POST', '**/api/subscription/upgrade', {
        statusCode: 200,
        body: {
          success: true,
          message: 'Upgrade successful',
          newPlan: 'enterprise'
        }
      }).as('upgradePlan')
      
      // Click upgrade
      cy.get('[data-plan="enterprise"]')
        .contains('button', /upgrade/i)
        .click()
      
      // Confirm upgrade
      cy.contains('button', /confirm.*upgrade/i).click()
      cy.wait('@upgradePlan')
      
      // Check success
      cy.contains(/upgrade.*successful/i).should('be.visible')
    })

    it('should handle plan downgrade with warning', () => {
      cy.visit('/billing/plans')
      
      // Try to downgrade
      cy.get('[data-plan="starter"]')
        .contains('button', /downgrade/i)
        .click()
      
      // Should show warning
      cy.contains(/lose.*features/i).should('be.visible')
      cy.contains('Advanced OCR').should('be.visible')
      
      // Confirm downgrade
      cy.contains('button', /proceed.*downgrade/i).click()
      
      // Mock downgrade
      cy.intercept('POST', '**/api/subscription/downgrade', {
        statusCode: 200,
        body: {
          success: true,
          effectiveDate: '2024-02-01'
        }
      }).as('downgradePlan')
      
      cy.wait('@downgradePlan')
      
      // Check scheduled
      cy.contains(/downgrade.*scheduled/i).should('be.visible')
      cy.contains('February 1').should('be.visible')
    })
  })

  describe('Credit Purchase', () => {
    it('should display credit packages', () => {
      cy.visit('/billing/buy-credits')
      
      // Mock credit packages
      cy.intercept('GET', '**/api/credits/packages', {
        statusCode: 200,
        body: {
          packages: [
            {
              id: 'pack-100',
              credits: 100,
              price: '$10',
              unitPrice: '$0.10'
            },
            {
              id: 'pack-500',
              credits: 500,
              price: '$45',
              unitPrice: '$0.09',
              savings: '10%'
            },
            {
              id: 'pack-1000',
              credits: 1000,
              price: '$80',
              unitPrice: '$0.08',
              savings: '20%'
            },
            {
              id: 'pack-5000',
              credits: 5000,
              price: '$350',
              unitPrice: '$0.07',
              savings: '30%'
            }
          ]
        }
      }).as('getPackages')
      
      cy.wait('@getPackages')
      
      // Check packages
      cy.contains('100 credits').should('be.visible')
      cy.contains('$10').should('be.visible')
      cy.contains('500 credits').should('be.visible')
      cy.contains('Save 10%').should('be.visible')
    })

    it('should purchase credit package', () => {
      cy.visit('/billing/buy-credits')
      
      // Select package
      cy.get('[data-package="pack-500"]').click()
      
      // Mock payment
      cy.intercept('POST', '**/api/credits/purchase', {
        statusCode: 200,
        body: {
          success: true,
          creditsAdded: 500,
          newBalance: 1000,
          transaction: {
            id: 'trans-123',
            amount: '$45',
            timestamp: new Date().toISOString()
          }
        }
      }).as('purchaseCredits')
      
      // Purchase
      cy.contains('button', /buy.*500.*credits/i).click()
      
      // Fill payment if needed (or use saved card)
      cy.contains('button', /confirm.*purchase/i).click()
      cy.wait('@purchaseCredits')
      
      // Check success
      cy.contains('500 credits added').should('be.visible')
      cy.contains('New balance: 1000').should('be.visible')
    })

    it('should apply promo code', () => {
      cy.visit('/billing/buy-credits')
      
      // Enter promo code
      cy.get('input[name="promoCode"]').type('SAVE20')
      cy.contains('button', /apply/i).click()
      
      // Mock promo validation
      cy.intercept('POST', '**/api/promo/validate', {
        statusCode: 200,
        body: {
          valid: true,
          discount: 20,
          description: '20% off credit purchase'
        }
      }).as('validatePromo')
      
      cy.wait('@validatePromo')
      
      // Check discount applied
      cy.contains('20% discount applied').should('be.visible')
      cy.contains('$36').should('be.visible') // 500 credits: $45 - 20%
    })
  })

  describe('Payment Methods', () => {
    it('should display saved payment methods', () => {
      cy.visit('/billing/payment-methods')
      
      // Mock payment methods
      cy.intercept('GET', '**/api/payment-methods', {
        statusCode: 200,
        body: {
          methods: [
            {
              id: 'pm-1',
              type: 'card',
              brand: 'Visa',
              last4: '1234',
              expiryMonth: 12,
              expiryYear: 2025,
              isDefault: true
            },
            {
              id: 'pm-2',
              type: 'card',
              brand: 'Mastercard',
              last4: '5678',
              expiryMonth: 6,
              expiryYear: 2024,
              isDefault: false
            }
          ]
        }
      }).as('getPaymentMethods')
      
      cy.wait('@getPaymentMethods')
      
      // Check cards display
      cy.contains('•••• 1234').should('be.visible')
      cy.contains('Visa').should('be.visible')
      cy.contains('Default').should('be.visible')
      cy.contains('•••• 5678').should('be.visible')
    })

    it('should add new payment method', () => {
      cy.visit('/billing/payment-methods')
      
      cy.contains('button', /add.*card/i).click()
      
      // Fill card details (in test mode)
      cy.get('input[name="cardNumber"]').type('4242424242424242')
      cy.get('input[name="expiry"]').type('12/25')
      cy.get('input[name="cvc"]').type('123')
      cy.get('input[name="zip"]').type('10001')
      
      // Mock add card
      cy.intercept('POST', '**/api/payment-methods', {
        statusCode: 201,
        body: {
          success: true,
          method: {
            id: 'pm-3',
            last4: '4242',
            brand: 'Visa'
          }
        }
      }).as('addCard')
      
      cy.contains('button', /save.*card/i).click()
      cy.wait('@addCard')
      
      // Check added
      cy.contains('•••• 4242').should('be.visible')
      cy.contains(/card.*added/i).should('be.visible')
    })

    it('should remove payment method', () => {
      cy.visit('/billing/payment-methods')
      
      // Mock removal
      cy.intercept('DELETE', '**/api/payment-methods/pm-2', {
        statusCode: 200,
        body: { success: true }
      }).as('removeCard')
      
      // Remove non-default card
      cy.get('[data-method-id="pm-2"]')
        .find('button').contains(/remove/i).click()
      
      // Confirm
      cy.contains('button', /confirm.*remove/i).click()
      cy.wait('@removeCard')
      
      // Check removed
      cy.get('[data-method-id="pm-2"]').should('not.exist')
    })

    it('should set default payment method', () => {
      cy.visit('/billing/payment-methods')
      
      // Mock set default
      cy.intercept('PUT', '**/api/payment-methods/pm-2/default', {
        statusCode: 200,
        body: { success: true }
      }).as('setDefault')
      
      // Set as default
      cy.get('[data-method-id="pm-2"]')
        .find('button').contains(/set.*default/i).click()
      
      cy.wait('@setDefault')
      
      // Check updated
      cy.get('[data-method-id="pm-2"]')
        .contains('Default').should('be.visible')
    })
  })

  describe('Billing Alerts', () => {
    it('should configure billing alerts', () => {
      cy.visit('/billing/alerts')
      
      // Configure alerts
      cy.get('input[name="lowCreditThreshold"]').clear().type('100')
      cy.get('input[name="emailAlerts"]').check()
      cy.get('input[name="smsAlerts"]').uncheck()
      
      // Mock save
      cy.intercept('PUT', '**/api/billing/alerts', {
        statusCode: 200,
        body: { success: true }
      }).as('saveAlerts')
      
      cy.contains('button', /save/i).click()
      cy.wait('@saveAlerts')
      
      // Check saved
      cy.contains(/alerts.*saved/i).should('be.visible')
    })

    it('should show upcoming renewal alert', () => {
      // Mock upcoming renewal
      cy.intercept('GET', '**/api/subscription/status', {
        statusCode: 200,
        body: {
          daysUntilRenewal: 3,
          nextBillingDate: '2024-01-24',
          amount: '$99'
        }
      }).as('getStatus')
      
      cy.visit('/dashboard')
      cy.wait('@getStatus')
      
      // Check renewal alert
      cy.contains(/renewal.*3 days/i).should('be.visible')
      cy.contains('$99').should('be.visible')
    })
  })
})