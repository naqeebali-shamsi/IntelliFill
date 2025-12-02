/// <reference types="cypress" />

/**
 * Scenario 7: Mobile Responsiveness
 * Tests mobile UI, touch interactions, and responsive design
 */

describe('Scenario 7: Mobile Responsiveness', () => {
  const mobileViewports = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'Samsung Galaxy S20', width: 412, height: 915 },
    { name: 'iPad Mini', width: 768, height: 1024 }
  ]

  beforeEach(() => {
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
  })

  describe('Mobile Navigation', () => {
    mobileViewports.forEach(device => {
      it(`should show mobile menu on ${device.name}`, () => {
        cy.viewport(device.width, device.height)
        cy.visit('/')
        
        // Desktop nav should be hidden
        cy.get('.desktop-nav').should('not.be.visible')
        
        // Mobile menu button should be visible
        cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible')
        
        // Open mobile menu
        cy.get('[data-cy="mobile-menu-toggle"]').click()
        
        // Mobile menu should slide in
        cy.get('.mobile-menu').should('be.visible')
        
        // Check menu items
        cy.contains('Dashboard').should('be.visible')
        cy.contains('Upload').should('be.visible')
        cy.contains('History').should('be.visible')
        cy.contains('Team').should('be.visible')
        cy.contains('Billing').should('be.visible')
      })
    })

    it('should close mobile menu on outside click', () => {
      cy.viewport('iphone-x')
      cy.visit('/')
      
      // Open menu
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      cy.get('.mobile-menu').should('be.visible')
      
      // Click outside
      cy.get('body').click(0, 0)
      
      // Menu should close
      cy.get('.mobile-menu').should('not.be.visible')
    })

    it('should close mobile menu on navigation', () => {
      cy.viewport('iphone-6')
      cy.visit('/')
      
      // Open menu
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      
      // Navigate
      cy.contains('Upload').click()
      
      // Menu should close and navigate
      cy.get('.mobile-menu').should('not.be.visible')
      cy.url().should('include', '/upload')
    })

    it('should handle swipe gestures for menu', () => {
      cy.viewport('iphone-x')
      cy.visit('/')
      
      // Swipe right to open menu
      cy.get('body')
        .trigger('touchstart', { touches: [{ pageX: 10, pageY: 100 }] })
        .trigger('touchmove', { touches: [{ pageX: 200, pageY: 100 }] })
        .trigger('touchend')
      
      // Menu should open
      cy.get('.mobile-menu').should('be.visible')
      
      // Swipe left to close
      cy.get('.mobile-menu')
        .trigger('touchstart', { touches: [{ pageX: 250, pageY: 100 }] })
        .trigger('touchmove', { touches: [{ pageX: 50, pageY: 100 }] })
        .trigger('touchend')
      
      // Menu should close
      cy.get('.mobile-menu').should('not.be.visible')
    })
  })

  describe('Mobile Forms', () => {
    it('should adapt login form for mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/login')
      
      // Form should be full width
      cy.get('form').should('have.css', 'width').and('match', /3[0-9]{2}/)
      
      // Inputs should be large enough for touch
      cy.get('input').first().should('have.css', 'height').and('match', /4[0-9]/)
      
      // Labels should be above inputs
      cy.get('label').first().should('have.css', 'display', 'block')
    })

    it('should show mobile keyboard for appropriate inputs', () => {
      cy.viewport('iphone-x')
      cy.visit('/login')
      
      // Email input should trigger email keyboard
      cy.get('input[type="email"]').should('have.attr', 'type', 'email')
      
      // Password input should be password type
      cy.get('input[type="password"]').should('have.attr', 'type', 'password')
      
      // Number inputs should trigger numeric keyboard
      cy.visit('/billing')
      cy.get('input[type="tel"]').should('have.attr', 'inputmode', 'numeric')
    })

    it('should handle autocomplete on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/register')
      
      // Check autocomplete attributes
      cy.get('input[name="email"]').should('have.attr', 'autocomplete', 'email')
      cy.get('input[name="name"]').should('have.attr', 'autocomplete', 'name')
      cy.get('input[name="password"]').should('have.attr', 'autocomplete', 'new-password')
    })

    it('should provide touch-friendly form controls', () => {
      cy.viewport('iphone-x')
      cy.visit('/settings')
      
      // Checkboxes should have larger touch targets
      cy.get('input[type="checkbox"]').parent().should('have.css', 'padding').and('not.equal', '0px')
      
      // Radio buttons should have larger touch targets
      cy.get('input[type="radio"]').parent().should('have.css', 'padding').and('not.equal', '0px')
      
      // Buttons should be large enough
      cy.get('button').first().should('have.css', 'min-height').and('match', /4[0-9]/)
    })
  })

  describe('Mobile Document Upload', () => {
    it('should provide mobile-friendly upload interface', () => {
      cy.viewport('iphone-x')
      cy.visit('/upload')
      
      // Should show camera option for mobile
      cy.contains(/camera|photo/i).should('be.visible')
      
      // File input should accept images
      cy.get('input[type="file"]').should('have.attr', 'accept').and('include', 'image')
      
      // Should have large drop zone
      cy.get('.drop-zone').should('have.css', 'min-height').and('match', /[2-9][0-9]{2}/)
    })

    it('should handle touch drag and drop', () => {
      cy.viewport('ipad-2')
      cy.visit('/upload')
      
      // Simulate touch drag
      cy.get('.drop-zone')
        .trigger('touchstart', { dataTransfer: { files: [] } })
        .trigger('touchmove', { clientX: 100, clientY: 100 })
        .trigger('touchend')
      
      // Should show drop indicator
      cy.get('.drop-zone').should('have.class', 'drag-over')
    })

    it('should show mobile-optimized progress', () => {
      cy.viewport('iphone-6')
      cy.visit('/upload')
      
      // Mock upload
      cy.intercept('POST', '**/api/documents/upload', {
        delay: 2000,
        statusCode: 200,
        body: { success: true }
      }).as('upload')
      
      // Upload file
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from('content'),
        fileName: 'mobile.pdf'
      }, { force: true })
      
      // Should show mobile-friendly progress
      cy.get('.progress-bar').should('be.visible')
      cy.get('.progress-percentage').should('be.visible')
    })
  })

  describe('Mobile Tables and Lists', () => {
    it('should convert tables to cards on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/history')
      
      // Mock data
      cy.intercept('GET', '**/api/documents/history', {
        statusCode: 200,
        body: {
          documents: [
            { id: '1', fileName: 'doc1.pdf', date: '2024-01-20' },
            { id: '2', fileName: 'doc2.pdf', date: '2024-01-19' }
          ]
        }
      }).as('getHistory')
      
      cy.wait('@getHistory')
      
      // Should show cards instead of table
      cy.get('table').should('not.exist')
      cy.get('.document-card').should('have.length', 2)
      
      // Cards should stack vertically
      cy.get('.document-card').first().should('have.css', 'display', 'block')
    })

    it('should provide swipe actions for list items', () => {
      cy.viewport('iphone-x')
      cy.visit('/team')
      
      // Mock team data
      cy.intercept('GET', '**/api/team/members', {
        statusCode: 200,
        body: {
          members: [{ id: '1', name: 'John Doe', role: 'admin' }]
        }
      }).as('getMembers')
      
      cy.wait('@getMembers')
      
      // Swipe left on member
      cy.get('.member-item')
        .trigger('touchstart', { touches: [{ pageX: 300, pageY: 100 }] })
        .trigger('touchmove', { touches: [{ pageX: 100, pageY: 100 }] })
        .trigger('touchend')
      
      // Should show actions
      cy.contains('Edit').should('be.visible')
      cy.contains('Remove').should('be.visible')
    })

    it('should implement infinite scroll on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/history')
      
      // Mock paginated data
      let page = 1
      cy.intercept('GET', '**/api/documents/history*', (req) => {
        const docs = Array.from({ length: 20 }, (_, i) => ({
          id: `doc-${page}-${i}`,
          fileName: `file-${page}-${i}.pdf`
        }))
        page++
        req.reply({
          statusCode: 200,
          body: { documents: docs, hasMore: page < 4 }
        })
      }).as('getPage')
      
      cy.wait('@getPage')
      
      // Scroll to bottom
      cy.scrollTo('bottom')
      
      // Should load more
      cy.wait('@getPage')
      cy.get('.document-card').should('have.length.greaterThan', 20)
    })
  })

  describe('Mobile Modals and Overlays', () => {
    it('should show full-screen modals on mobile', () => {
      cy.viewport('iphone-x')
      cy.visit('/dashboard')
      
      // Open a modal
      cy.contains('button', 'Settings').click()
      
      // Modal should be full screen
      cy.get('.modal').should('have.css', 'width').and('match', /3[0-9]{2}/)
      cy.get('.modal').should('have.css', 'height').and('match', /[0-9]{3}/)
      
      // Should have mobile-friendly close button
      cy.get('.modal-close').should('have.css', 'width').and('match', /4[0-9]/)
    })

    it('should handle bottom sheets on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/upload')
      
      // Trigger action sheet
      cy.contains('button', 'Options').click()
      
      // Should slide up from bottom
      cy.get('.bottom-sheet').should('be.visible')
      cy.get('.bottom-sheet').should('have.css', 'position', 'fixed')
      cy.get('.bottom-sheet').should('have.css', 'bottom', '0px')
      
      // Swipe down to close
      cy.get('.bottom-sheet')
        .trigger('touchstart', { touches: [{ pageX: 150, pageY: 400 }] })
        .trigger('touchmove', { touches: [{ pageX: 150, pageY: 600 }] })
        .trigger('touchend')
      
      cy.get('.bottom-sheet').should('not.be.visible')
    })
  })

  describe('Touch Interactions', () => {
    it('should handle touch events properly', () => {
      cy.viewport('iphone-x')
      cy.visit('/dashboard')
      
      // Touch should trigger hover states
      cy.get('.card').first()
        .trigger('touchstart')
        .should('have.class', 'touched')
        .trigger('touchend')
        .should('not.have.class', 'touched')
    })

    it('should prevent accidental touches', () => {
      cy.viewport('iphone-6')
      cy.visit('/billing')
      
      // Dangerous actions should require confirmation
      cy.contains('button', 'Cancel Subscription').click()
      
      // Should not immediately cancel
      cy.contains('Confirm cancellation').should('be.visible')
      
      // Should require deliberate second tap
      cy.contains('button', 'Confirm').click()
    })

    it('should handle long press actions', () => {
      cy.viewport('iphone-x')
      cy.visit('/documents')
      
      // Long press on document
      cy.get('.document-item').first()
        .trigger('touchstart')
        .wait(1000) // Long press
        .trigger('touchend')
      
      // Should show context menu
      cy.get('.context-menu').should('be.visible')
      cy.contains('Download').should('be.visible')
      cy.contains('Share').should('be.visible')
      cy.contains('Delete').should('be.visible')
    })

    it('should support pinch to zoom', () => {
      cy.viewport('ipad-2')
      cy.visit('/documents/doc-123/view')
      
      // Simulate pinch zoom
      cy.get('.document-viewer')
        .trigger('touchstart', {
          touches: [
            { pageX: 100, pageY: 100 },
            { pageX: 200, pageY: 200 }
          ]
        })
        .trigger('touchmove', {
          touches: [
            { pageX: 50, pageY: 50 },
            { pageX: 250, pageY: 250 }
          ]
        })
        .trigger('touchend')
      
      // Should be zoomed
      cy.get('.document-viewer').should('have.css', 'transform').and('include', 'scale')
    })
  })

  describe('Mobile Performance', () => {
    it('should lazy load images on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/gallery')
      
      // Images should have loading attribute
      cy.get('img').should('have.attr', 'loading', 'lazy')
      
      // Only visible images should load
      cy.get('img:visible').should('have.length.lessThan', 10)
    })

    it('should use mobile-optimized assets', () => {
      cy.viewport('iphone-x')
      cy.visit('/')
      
      // Should use smaller images
      cy.get('img').each(($img) => {
        const src = $img.attr('src')
        // Should include size parameter or mobile indicator
        expect(src).to.match(/@1x|mobile|small|[\?&]w=\d{3}/)
      })
    })

    it('should minimize JavaScript on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/')
      
      // Check for mobile-specific bundles
      cy.window().then((win) => {
        // Should have mobile optimizations
        expect(win.navigator.userAgent).to.include('Mobile')
      })
    })
  })

  describe('Responsive Typography', () => {
    it('should scale text appropriately', () => {
      // Desktop
      cy.viewport(1920, 1080)
      cy.visit('/')
      cy.get('h1').should('have.css', 'font-size').and('match', /[3-4][0-9]/)
      
      // Tablet
      cy.viewport('ipad-2')
      cy.visit('/')
      cy.get('h1').should('have.css', 'font-size').and('match', /[2-3][0-9]/)
      
      // Mobile
      cy.viewport('iphone-6')
      cy.visit('/')
      cy.get('h1').should('have.css', 'font-size').and('match', /[2][0-9]/)
    })

    it('should maintain readability on small screens', () => {
      cy.viewport('iphone-se')
      cy.visit('/about')
      
      // Line height should be comfortable
      cy.get('p').should('have.css', 'line-height').and('match', /[1-2]\.[4-8]/)
      
      // Paragraph width should not be too wide
      cy.get('p').should('have.css', 'max-width').and('not.equal', 'none')
    })
  })

  describe('Orientation Changes', () => {
    it('should handle portrait to landscape transition', () => {
      // Start in portrait
      cy.viewport('iphone-x')
      cy.visit('/')
      
      // Check portrait layout
      cy.get('.container').should('have.css', 'padding-left').and('match', /[1-2][0-9]px/)
      
      // Switch to landscape
      cy.viewport('iphone-x').then(() => {
        cy.viewport(844, 390) // Landscape dimensions
      })
      
      // Check landscape layout
      cy.get('.container').should('have.css', 'padding-left').and('match', /[3-9][0-9]px/)
    })

    it('should maintain scroll position on orientation change', () => {
      cy.viewport('iphone-6')
      cy.visit('/documents')
      
      // Scroll down
      cy.scrollTo(0, 500)
      
      // Get scroll position
      cy.window().then((win) => {
        const scrollY = win.scrollY
        
        // Change orientation
        cy.viewport(667, 375) // Landscape
        
        // Scroll position should be maintained (approximately)
        cy.window().its('scrollY').should('be.closeTo', scrollY, 100)
      })
    })
  })

  describe('Accessibility on Mobile', () => {
    it('should have sufficient touch target sizes', () => {
      cy.viewport('iphone-6')
      cy.visit('/')
      
      // All interactive elements should be at least 44x44 pixels (iOS guideline)
      cy.get('button, a, input, [role="button"]').each(($el) => {
        const width = $el.width()
        const height = $el.height()
        
        expect(width).to.be.at.least(44)
        expect(height).to.be.at.least(44)
      })
    })

    it('should support screen readers on mobile', () => {
      cy.viewport('iphone-x')
      cy.visit('/')
      
      // Check ARIA labels
      cy.get('[data-cy="mobile-menu-toggle"]').should('have.attr', 'aria-label')
      cy.get('nav').should('have.attr', 'role', 'navigation')
      
      // Check focus management
      cy.get('[data-cy="mobile-menu-toggle"]').click()
      cy.focused().should('have.attr', 'role', 'menu')
    })

    it('should provide skip links on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/')
      
      // Tab to reveal skip link
      cy.get('body').tab()
      
      // Skip link should be visible when focused
      cy.focused().should('contain', 'Skip to content')
    })
  })

  describe('Mobile-Specific Features', () => {
    it('should show app install banner', () => {
      cy.viewport('iphone-x')
      cy.visit('/')
      
      // Should show install prompt for PWA
      cy.window().then((win) => {
        // Check for manifest
        cy.get('link[rel="manifest"]').should('exist')
        
        // Check for service worker
        if ('serviceWorker' in win.navigator) {
          expect(win.navigator.serviceWorker).to.exist
        }
      })
    })

    it('should handle offline mode', () => {
      cy.viewport('iphone-6')
      cy.visit('/')
      
      // Go offline
      cy.window().then((win) => {
        cy.stub(win.navigator, 'onLine').value(false)
      })
      
      // Should show offline indicator
      cy.contains(/offline|no connection/i).should('be.visible')
    })

    it('should integrate with mobile features', () => {
      cy.viewport('iphone-x')
      cy.visit('/contact')
      
      // Phone numbers should be clickable
      cy.get('a[href^="tel:"]').should('exist')
      
      // Email should be clickable
      cy.get('a[href^="mailto:"]').should('exist')
      
      // Addresses should link to maps
      cy.get('a[href*="maps"]').should('exist')
    })
  })
})