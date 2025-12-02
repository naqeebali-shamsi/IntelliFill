/// <reference types="cypress" />

/**
 * Mobile Responsiveness E2E Tests
 * 
 * Tests mobile and responsive behavior across different devices including:
 * - Touch interactions and gestures
 * - Mobile navigation and menu behavior
 * - Responsive layout adaptations
 * - Portrait/landscape orientation changes
 * - Mobile-specific features (camera, file picker)
 * - Performance on mobile devices
 * - Accessibility on touch devices
 */

describe('Mobile Responsiveness', () => {
  let testUser: any
  let testCompany: any

  // Common mobile viewport configurations
  const viewports = {
    mobile: { width: 375, height: 667 }, // iPhone SE
    mobileLarge: { width: 414, height: 896 }, // iPhone 11 Pro Max
    tablet: { width: 768, height: 1024 }, // iPad
    tabletLandscape: { width: 1024, height: 768 }, // iPad Landscape
    desktop: { width: 1280, height: 720 } // Desktop
  }

  before(() => {
    cy.fixture('users').then((users) => {
      testUser = users.testUser
      testCompany = users.companies[0]
    })
  })

  beforeEach(() => {
    cy.clearAuth()
  })

  afterEach(() => {
    cy.clearAuth()
  })

  describe('Mobile Login and Navigation', () => {
    Object.entries(viewports).forEach(([device, viewport]) => {
      it(`should display login form correctly on ${device}`, () => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit('/login')

        // Verify form is visible and properly sized
        cy.get('[data-cy="login-form"]')
          .should('be.visible')
          .should('have.css', 'width')
          .and('not.equal', '0px')

        // Check if elements are properly stacked on mobile
        if (viewport.width < 768) {
          cy.get('[data-cy="login-card"]')
            .should('have.css', 'max-width')

          cy.get('[data-cy="email-input"]')
            .should('be.visible')
            .should('have.css', 'width')

          cy.get('[data-cy="password-input"]')
            .should('be.visible')

          cy.get('[data-cy="login-button"]')
            .should('be.visible')
            .should('have.css', 'width', '100%')
        }

        // Test form functionality
        cy.get('[data-cy="email-input"]').type(testUser.email)
        cy.get('[data-cy="password-input"]').type(testUser.password)

        // Verify touch-friendly button size
        cy.get('[data-cy="login-button"]')
          .should('have.css', 'min-height')
          .and('match', /^(?:4[4-9]|[5-9]\d|\d{3,})px$/) // At least 44px for touch targets
      })
    })

    it('should handle mobile keyboard interactions', () => {
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
      cy.visit('/login')

      // Test input field focus and keyboard behavior
      cy.get('[data-cy="email-input"]')
        .focus()
        .should('have.focus')

      // Verify virtual keyboard doesn't break layout
      cy.get('[data-cy="login-form"]')
        .should('be.visible')

      // Test tab navigation
      cy.get('[data-cy="email-input"]').tab()
      cy.get('[data-cy="password-input"]').should('have.focus')

      cy.get('[data-cy="password-input"]').tab()
      cy.get('[data-cy="login-button"]').should('have.focus')
    })

    it('should provide mobile-optimized navigation menu', () => {
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
      cy.loginViaApi(testUser)
      cy.visit('/dashboard')

      // Mobile menu should be hamburger style
      cy.get('[data-cy="mobile-menu-toggle"]')
        .should('be.visible')

      // Desktop navigation should be hidden on mobile
      cy.get('[data-cy="desktop-navigation"]')
        .should('not.be.visible')

      // Open mobile menu
      cy.get('[data-cy="mobile-menu-toggle"]').click()

      cy.get('[data-cy="mobile-menu"]')
        .should('be.visible')
        .should('have.class', 'slide-in')

      // Test menu items
      cy.get('[data-cy="mobile-menu"]')
        .within(() => {
          cy.get('[data-cy="menu-dashboard"]').should('be.visible')
          cy.get('[data-cy="menu-documents"]').should('be.visible')
          cy.get('[data-cy="menu-team"]').should('be.visible')
          cy.get('[data-cy="menu-settings"]').should('be.visible')
        })

      // Close menu by clicking outside
      cy.get('[data-cy="mobile-menu-overlay"]').click()

      cy.get('[data-cy="mobile-menu"]')
        .should('not.be.visible')
    })
  })

  describe('Touch Interactions and Gestures', () => {
    beforeEach(() => {
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
      cy.loginViaApi(testUser)
    })

    it('should support touch interactions for file upload', () => {
      cy.visit('/documents/upload')

      // Test touch-friendly upload area
      cy.get('[data-cy="upload-zone"]')
        .should('be.visible')
        .should('have.css', 'min-height')
        .and('match', /^(?:1[0-9]{2,}|\d{3,})px$/) // At least 100px height

      // Test touch events
      cy.get('[data-cy="upload-zone"]')
        .trigger('touchstart')
        .trigger('touchend')

      cy.get('[data-cy="upload-zone-active"]')
        .should('exist')

      // Test mobile file picker
      cy.get('[data-cy="mobile-file-picker-button"]')
        .should('be.visible')
        .should('have.css', 'min-height', '44px') // Touch-friendly size

      cy.get('[data-cy="mobile-file-picker-button"]').click()

      // Should open native file picker
      cy.get('[data-cy="file-input"]')
        .should('have.attr', 'accept')
        .and('include', '.pdf,.docx,.doc,.png,.jpg,.jpeg')
    })

    it('should support swipe gestures for document navigation', () => {
      cy.visit('/documents/doc_123/review')

      cy.get('[data-cy="document-viewer"]')
        .should('be.visible')

      // Test swipe left (next page)
      cy.get('[data-cy="document-viewer"]')
        .trigger('touchstart', { touches: [{ clientX: 300, clientY: 300 }] })
        .trigger('touchmove', { touches: [{ clientX: 100, clientY: 300 }] })
        .trigger('touchend')

      cy.get('[data-cy="page-indicator"]')
        .should('contain', 'Page 2')

      // Test swipe right (previous page)
      cy.get('[data-cy="document-viewer"]')
        .trigger('touchstart', { touches: [{ clientX: 100, clientY: 300 }] })
        .trigger('touchmove', { touches: [{ clientX: 300, clientY: 300 }] })
        .trigger('touchend')

      cy.get('[data-cy="page-indicator"]')
        .should('contain', 'Page 1')
    })

    it('should support pinch-to-zoom on documents', () => {
      cy.visit('/documents/doc_123/review')

      cy.get('[data-cy="document-viewer"]')
        .should('be.visible')

      // Simulate pinch-to-zoom
      cy.get('[data-cy="document-viewer"]')
        .trigger('touchstart', {
          touches: [
            { clientX: 200, clientY: 200 },
            { clientX: 250, clientY: 250 }
          ]
        })
        .trigger('touchmove', {
          touches: [
            { clientX: 150, clientY: 150 },
            { clientX: 300, clientY: 300 }
          ]
        })
        .trigger('touchend')

      cy.get('[data-cy="zoom-level-indicator"]')
        .should('be.visible')
        .should('contain', 'Zoom:')

      // Test zoom controls for mobile
      cy.get('[data-cy="zoom-in-button"]')
        .should('be.visible')
        .should('have.css', 'min-height', '44px')

      cy.get('[data-cy="zoom-out-button"]')
        .should('be.visible')
        .should('have.css', 'min-height', '44px')

      cy.get('[data-cy="zoom-reset-button"]')
        .should('be.visible')
    })

    it('should support pull-to-refresh on lists', () => {
      cy.visit('/documents')

      cy.get('[data-cy="documents-list"]')
        .should('be.visible')

      // Simulate pull-to-refresh gesture
      cy.get('[data-cy="documents-list"]')
        .trigger('touchstart', { touches: [{ clientX: 200, clientY: 50 }] })
        .trigger('touchmove', { touches: [{ clientX: 200, clientY: 200 }] })

      cy.get('[data-cy="pull-to-refresh-indicator"]')
        .should('be.visible')
        .should('contain', 'Release to refresh')

      cy.get('[data-cy="documents-list"]')
        .trigger('touchend')

      cy.get('[data-cy="refreshing-indicator"]')
        .should('be.visible')

      cy.get('[data-cy="refresh-complete-message"]')
        .should('eventually.be.visible')
    })
  })

  describe('Responsive Layout Adaptations', () => {
    it('should adapt dashboard layout across viewports', () => {
      cy.loginViaApi(testUser)

      Object.entries(viewports).forEach(([device, viewport]) => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit('/dashboard')

        // Check responsive grid behavior
        if (viewport.width < 768) {
          // Mobile: Single column layout
          cy.get('[data-cy="dashboard-grid"]')
            .should('have.css', 'grid-template-columns')
            .and('match', /1fr|repeat\(1,/)

          cy.get('[data-cy="stats-cards"]')
            .children()
            .should('have.length.greaterThan', 0)
            .each(($card) => {
              cy.wrap($card).should('have.css', 'width')
            })
        } else if (viewport.width < 1024) {
          // Tablet: Two column layout
          cy.get('[data-cy="dashboard-grid"]')
            .should('have.css', 'grid-template-columns')
            .and('match', /repeat\(2,|1fr\s+1fr/)
        } else {
          // Desktop: Multi-column layout
          cy.get('[data-cy="dashboard-grid"]')
            .should('have.css', 'grid-template-columns')
            .and('match', /repeat\([3-9],|(?:1fr\s*){3,}/)
        }

        // Verify content is never horizontally scrollable
        cy.get('body').should('not.have.css', 'overflow-x', 'scroll')
      })
    })

    it('should adapt table layouts on mobile', () => {
      cy.loginViaApi(testUser)
      cy.visit('/documents')

      // Desktop table view
      cy.viewport(viewports.desktop.width, viewports.desktop.height)

      cy.get('[data-cy="documents-table"]')
        .should('be.visible')
        .should('have.css', 'display', 'table')

      // Mobile card view
      cy.viewport(viewports.mobile.width, viewports.mobile.height)

      cy.get('[data-cy="documents-table"]')
        .should('not.be.visible')

      cy.get('[data-cy="documents-mobile-list"]')
        .should('be.visible')

      cy.get('[data-cy="document-card"]')
        .should('have.length.greaterThan', 0)
        .first()
        .within(() => {
          cy.get('[data-cy="document-name"]').should('be.visible')
          cy.get('[data-cy="document-date"]').should('be.visible')
          cy.get('[data-cy="document-status"]').should('be.visible')
          cy.get('[data-cy="document-actions"]').should('be.visible')
        })
    })

    it('should adapt forms for mobile input', () => {
      cy.loginViaApi(testUser)
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
      cy.visit('/team/invite')

      // Form should be single column on mobile
      cy.get('[data-cy="invite-form"]')
        .should('be.visible')

      cy.get('[data-cy="form-fields"]')
        .should('have.css', 'flex-direction', 'column')

      // Input fields should be full width
      cy.get('[data-cy="member-email-input"]')
        .should('have.css', 'width', '100%')

      // Labels should be above inputs (not side-by-side)
      cy.get('[data-cy="email-label"]')
        .should('be.visible')

      cy.get('[data-cy="member-email-input"]')
        .should('be.visible')

      // Check label and input positioning
      cy.get('[data-cy="email-label"]').then(($label) => {
        cy.get('[data-cy="member-email-input"]').then(($input) => {
          expect($label[0].getBoundingClientRect().bottom)
            .to.be.lessThan($input[0].getBoundingClientRect().top)
        })
      })
    })
  })

  describe('Orientation Changes', () => {
    it('should handle portrait to landscape transitions', () => {
      cy.loginViaApi(testUser)

      // Start in portrait
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
      cy.visit('/dashboard')

      cy.get('[data-cy="dashboard-content"]')
        .should('be.visible')

      // Switch to landscape
      cy.viewport(viewports.mobile.height, viewports.mobile.width)

      // Content should remain accessible
      cy.get('[data-cy="dashboard-content"]')
        .should('be.visible')

      // Navigation should adapt
      cy.get('[data-cy="mobile-menu-toggle"]')
        .should('be.visible')

      // Stats cards should reflow
      cy.get('[data-cy="stats-cards"]')
        .should('be.visible')
        .children()
        .should('be.visible')
    })

    it('should optimize document viewer for landscape', () => {
      cy.loginViaApi(testUser)
      cy.visit('/documents/doc_123/review')

      // Portrait mode
      cy.viewport(viewports.mobile.width, viewports.mobile.height)

      cy.get('[data-cy="document-viewer"]')
        .should('be.visible')

      cy.get('[data-cy="field-panel"]')
        .should('be.visible')

      // Switch to landscape
      cy.viewport(viewports.mobile.height, viewports.mobile.width)

      // Should show side-by-side layout in landscape
      cy.get('[data-cy="viewer-container"]')
        .should('have.css', 'flex-direction')
        .and('match', /(row|horizontal)/)

      cy.get('[data-cy="document-viewer"]')
        .should('be.visible')

      cy.get('[data-cy="field-panel"]')
        .should('be.visible')
    })

    it('should handle orientation change during file upload', () => {
      cy.loginViaApi(testUser)
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
      cy.visit('/documents/upload')

      // Start upload in portrait
      cy.fixture('sample.pdf', 'base64').then(fileContent => {
        cy.get('[data-cy="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'sample.pdf',
          mimeType: 'application/pdf'
        }, { force: true })
      })

      cy.get('[data-cy="upload-progress"]')
        .should('be.visible')

      // Change to landscape during upload
      cy.viewport(viewports.mobile.height, viewports.mobile.width)

      // Upload should continue
      cy.get('[data-cy="upload-progress"]')
        .should('be.visible')

      cy.get('[data-cy="upload-progress-bar"]')
        .should('be.visible')
    })
  })

  describe('Mobile-Specific Features', () => {
    beforeEach(() => {
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
      cy.loginViaApi(testUser)
    })

    it('should support camera capture for document upload', () => {
      cy.visit('/documents/upload')

      // Should show camera option on mobile
      cy.get('[data-cy="camera-capture-button"]')
        .should('be.visible')
        .should('contain', 'Take Photo')

      cy.get('[data-cy="camera-capture-button"]').click()

      // Should access camera API
      cy.get('[data-cy="camera-modal"]')
        .should('be.visible')

      cy.get('[data-cy="camera-preview"]')
        .should('be.visible')

      cy.get('[data-cy="capture-photo-button"]')
        .should('be.visible')
        .should('have.css', 'min-height', '44px')

      cy.get('[data-cy="switch-camera-button"]')
        .should('be.visible')

      cy.get('[data-cy="close-camera-button"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="camera-modal"]')
        .should('not.exist')
    })

    it('should provide mobile share functionality', () => {
      cy.visit('/documents/doc_123')

      cy.get('[data-cy="share-button"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="share-options"]')
        .should('be.visible')

      // Should show native share option on mobile
      cy.get('[data-cy="native-share-button"]')
        .should('be.visible')
        .should('contain', 'Share')

      // Should show copy link option
      cy.get('[data-cy="copy-link-button"]')
        .should('be.visible')

      // Should show email option
      cy.get('[data-cy="email-share-button"]')
        .should('be.visible')
    })

    it('should support offline functionality', () => {
      cy.visit('/documents')

      // Mock offline state
      cy.window().then((win) => {
        win.navigator.onLine = false
        win.dispatchEvent(new Event('offline'))
      })

      cy.get('[data-cy="offline-banner"]')
        .should('be.visible')
        .should('contain', 'You are offline')

      // Should show cached documents
      cy.get('[data-cy="cached-documents"]')
        .should('be.visible')

      cy.get('[data-cy="sync-when-online-message"]')
        .should('be.visible')
        .should('contain', 'Changes will sync when online')

      // Test going back online
      cy.window().then((win) => {
        win.navigator.onLine = true
        win.dispatchEvent(new Event('online'))
      })

      cy.get('[data-cy="online-banner"]')
        .should('be.visible')
        .should('contain', 'You are back online')

      cy.get('[data-cy="syncing-indicator"]')
        .should('be.visible')
    })

    it('should handle device memory constraints', () => {
      cy.visit('/documents/upload')

      // Mock low memory scenario
      cy.window().then((win) => {
        Object.defineProperty(win.navigator, 'deviceMemory', {
          value: 1, // 1GB RAM
          configurable: true
        })
      })

      // Try to upload large file
      const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf'
      })

      cy.get('[data-cy="file-input"]').selectFile(largeFile, { force: true })

      cy.get('[data-cy="memory-warning"]')
        .should('be.visible')
        .should('contain', 'Large file detected')

      cy.get('[data-cy="reduce-quality-option"]')
        .should('be.visible')

      cy.get('[data-cy="process-in-background-option"]')
        .should('be.visible')
    })
  })

  describe('Performance on Mobile Devices', () => {
    beforeEach(() => {
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
    })

    it('should lazy load images and content', () => {
      cy.loginViaApi(testUser)
      cy.visit('/documents')

      // Images should have lazy loading
      cy.get('[data-cy="document-thumbnail"]')
        .should('have.attr', 'loading', 'lazy')

      // Content should load progressively
      cy.get('[data-cy="documents-list"]')
        .should('be.visible')

      cy.scrollTo('bottom')

      cy.get('[data-cy="load-more-indicator"]')
        .should('be.visible')

      cy.get('[data-cy="loading-spinner"]')
        .should('be.visible')
    })

    it('should implement virtual scrolling for long lists', () => {
      cy.loginViaApi(testUser)

      // Mock large dataset
      cy.intercept('GET', '/api/documents', {
        statusCode: 200,
        body: {
          documents: Array.from({ length: 1000 }, (_, i) => ({
            id: `doc_${i}`,
            name: `Document ${i}`,
            status: 'processed'
          })),
          total: 1000
        }
      }).as('getLargeDocumentList')

      cy.visit('/documents')
      cy.wait('@getLargeDocumentList')

      // Should not render all 1000 items at once
      cy.get('[data-cy="document-item"]')
        .should('have.length.lessThan', 50)

      // Should implement virtual scrolling
      cy.get('[data-cy="virtual-scroll-container"]')
        .should('be.visible')

      cy.scrollTo('bottom')

      // More items should load
      cy.get('[data-cy="document-item"]')
        .should('have.length.greaterThan', 20)
    })

    it('should optimize animations for mobile', () => {
      cy.loginViaApi(testUser)
      cy.visit('/dashboard')

      // Check for reduced motion support
      cy.window().its('matchMedia').invoke('(prefers-reduced-motion: reduce)')
        .its('matches').then((prefersReducedMotion) => {
          if (prefersReducedMotion) {
            cy.get('[data-cy="animated-element"]')
              .should('have.css', 'animation-duration', '0s')
          }
        })

      // Animations should be GPU-accelerated
      cy.get('[data-cy="slide-in-element"]')
        .should('have.css', 'transform')
        .and('not.equal', 'none')

      // Transitions should use transform instead of layout properties
      cy.get('[data-cy="mobile-menu"]')
        .should('have.css', 'transition-property')
        .and('include', 'transform')
    })
  })

  describe('Accessibility on Touch Devices', () => {
    beforeEach(() => {
      cy.viewport(viewports.mobile.width, viewports.mobile.height)
      cy.loginViaApi(testUser)
    })

    it('should provide adequate touch targets', () => {
      cy.visit('/dashboard')

      // All interactive elements should be at least 44px
      cy.get('[data-cy="interactive-element"]').each(($element) => {
        cy.wrap($element)
          .should('have.css', 'min-height')
          .and('match', /^(?:4[4-9]|[5-9]\d|\d{3,})px$/)

        cy.wrap($element)
          .should('have.css', 'min-width')
          .and('match', /^(?:4[4-9]|[5-9]\d|\d{3,})px$/)
      })
    })

    it('should support screen reader navigation', () => {
      cy.visit('/documents/upload')

      // Should have proper ARIA labels
      cy.get('[data-cy="upload-zone"]')
        .should('have.attr', 'aria-label')
        .and('include', 'upload')

      // Should have proper heading structure
      cy.get('h1, h2, h3, h4, h5, h6').each(($heading, index, $headings) => {
        const currentLevel = parseInt($heading.prop('tagName').charAt(1))
        if (index > 0) {
          const previousLevel = parseInt($headings.eq(index - 1).prop('tagName').charAt(1))
          expect(currentLevel).to.be.at.most(previousLevel + 1)
        }
      })

      // Focus management should be proper
      cy.get('[data-cy="upload-zone"]').focus()
      cy.get('[data-cy="upload-zone"]').should('have.focus')

      cy.tab()
      cy.focused().should('have.attr', 'tabindex').and('not.equal', '-1')
    })

    it('should support voice control commands', () => {
      cy.visit('/documents')

      // Elements should have voice-friendly labels
      cy.get('[data-cy="search-button"]')
        .should('have.attr', 'aria-label')
        .and('match', /search|find/i)

      cy.get('[data-cy="upload-button"]')
        .should('have.attr', 'aria-label')
        .and('match', /upload|add/i)

      // Actions should be keyboard accessible
      cy.get('[data-cy="upload-button"]')
        .focus()
        .type('{enter}')

      cy.url().should('include', '/upload')
    })

    it('should provide haptic feedback indicators', () => {
      cy.visit('/documents/upload')

      // Success actions should indicate feedback availability
      cy.get('[data-cy="upload-success-message"]')
        .should('have.attr', 'data-haptic', 'success')

      // Error actions should indicate feedback
      cy.get('[data-cy="upload-error-message"]')
        .should('have.attr', 'data-haptic', 'error')

      // Important actions should indicate feedback
      cy.get('[data-cy="delete-document-button"]')
        .should('have.attr', 'data-haptic', 'warning')
    })
  })

  describe('Cross-Device Testing', () => {
    it('should work consistently across mobile browsers', () => {
      const userAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', // iOS Safari
        'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36', // Android Chrome
        'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.120 Mobile Safari/537.36' // Android WebView
      ]

      userAgents.forEach((userAgent) => {
        cy.viewport(viewports.mobile.width, viewports.mobile.height)
        
        cy.visit('/login', {
          onBeforeLoad: (win) => {
            Object.defineProperty(win.navigator, 'userAgent', {
              value: userAgent
            })
          }
        })

        cy.get('[data-cy="login-form"]')
          .should('be.visible')

        cy.get('[data-cy="email-input"]')
          .should('be.visible')
          .type(testUser.email)

        cy.get('[data-cy="password-input"]')
          .should('be.visible')
          .type(testUser.password)

        cy.get('[data-cy="login-button"]')
          .should('be.visible')
          .should('not.be.disabled')
      })
    })

    it('should handle different screen densities', () => {
      const densities = [1, 2, 3] // 1x, 2x, 3x pixel density

      densities.forEach((density) => {
        cy.viewport(viewports.mobile.width, viewports.mobile.height)
        
        cy.visit('/dashboard', {
          onBeforeLoad: (win) => {
            Object.defineProperty(win, 'devicePixelRatio', {
              value: density
            })
          }
        })

        cy.loginViaApi(testUser)

        // Images should load appropriate resolution
        cy.get('[data-cy="company-logo"]')
          .should('be.visible')
          .should('have.attr', 'src')

        // Text should remain readable
        cy.get('[data-cy="dashboard-title"]')
          .should('be.visible')
          .should('have.css', 'font-size')
          .and('match', /\d+px/)
      })
    })
  })
})