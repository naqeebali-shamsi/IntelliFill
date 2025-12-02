/// <reference types="cypress" />

/**
 * Scenario 4: Team Collaboration
 * Tests team member management, roles, and permissions
 */

describe('Scenario 4: Team Collaboration', () => {
  const ownerUser = {
    id: 'owner-123',
    email: 'owner@techstart.com',
    name: 'Company Owner',
    role: 'owner'
  }

  const company = {
    id: 'company-123',
    name: 'TechStart Inc',
    slug: 'techstart-2024',
    tier: 'professional'
  }

  beforeEach(() => {
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    cy.clearAllCookies()
    
    // Set owner session by default
    cy.window().then((win) => {
      win.localStorage.setItem('intellifill-auth', JSON.stringify({
        state: {
          user: ownerUser,
          company: company,
          tokens: {
            accessToken: 'owner-token',
            refreshToken: 'owner-refresh',
            expiresAt: Date.now() + 3600000
          },
          isAuthenticated: true
        }
      }))
    })
  })

  describe('Team Member Management', () => {
    it('should display team members list', () => {
      cy.visit('/team')
      
      // Mock team members
      cy.intercept('GET', '**/api/team/members', {
        statusCode: 200,
        body: {
          members: [
            {
              id: 'member-1',
              name: 'John Doe',
              email: 'john@techstart.com',
              role: 'owner',
              status: 'active',
              joinedAt: '2024-01-01T00:00:00Z'
            },
            {
              id: 'member-2',
              name: 'Jane Smith',
              email: 'jane@techstart.com',
              role: 'admin',
              status: 'active',
              joinedAt: '2024-01-05T00:00:00Z'
            },
            {
              id: 'member-3',
              name: 'Bob Wilson',
              email: 'bob@techstart.com',
              role: 'user',
              status: 'active',
              joinedAt: '2024-01-10T00:00:00Z'
            }
          ],
          totalCount: 3
        }
      }).as('getMembers')
      
      cy.wait('@getMembers')
      
      // Check team members display
      cy.contains('John Doe').should('be.visible')
      cy.contains('jane@techstart.com').should('be.visible')
      cy.contains('Bob Wilson').should('be.visible')
      
      // Check roles display
      cy.contains('Owner').should('be.visible')
      cy.contains('Admin').should('be.visible')
      cy.contains('User').should('be.visible')
    })

    it('should invite new team member', () => {
      cy.visit('/team')
      
      // Click invite button
      cy.contains('button', /invite.*member/i).click()
      
      // Fill invitation form
      cy.get('input[type="email"]').type('newmember@techstart.com')
      cy.get('select[name="role"]').select('user')
      
      // Mock invitation API
      cy.intercept('POST', '**/api/team/invite', {
        statusCode: 201,
        body: {
          success: true,
          invitation: {
            id: 'invite-123',
            email: 'newmember@techstart.com',
            role: 'user',
            status: 'pending',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      }).as('sendInvite')
      
      // Send invitation
      cy.contains('button', /send.*invite/i).click()
      cy.wait('@sendInvite')
      
      // Check success message
      cy.contains(/invitation.*sent/i).should('be.visible')
      cy.contains('newmember@techstart.com').should('be.visible')
    })

    it('should handle bulk invitations', () => {
      cy.visit('/team')
      
      cy.contains('button', /bulk.*invite/i).click()
      
      // Enter multiple emails
      cy.get('textarea[name="emails"]').type(
        'user1@techstart.com\nuser2@techstart.com\nuser3@techstart.com'
      )
      
      // Select role for all
      cy.get('select[name="bulkRole"]').select('user')
      
      // Mock bulk invite
      cy.intercept('POST', '**/api/team/invite/bulk', {
        statusCode: 201,
        body: {
          success: true,
          sent: 3,
          failed: 0
        }
      }).as('bulkInvite')
      
      cy.contains('button', /send.*invitations/i).click()
      cy.wait('@bulkInvite')
      
      // Check success
      cy.contains('3 invitations sent').should('be.visible')
    })

    it('should manage pending invitations', () => {
      cy.visit('/team/invitations')
      
      // Mock pending invitations
      cy.intercept('GET', '**/api/team/invitations', {
        statusCode: 200,
        body: {
          invitations: [
            {
              id: 'invite-1',
              email: 'pending1@techstart.com',
              role: 'user',
              status: 'pending',
              sentAt: '2024-01-15T10:00:00Z',
              expiresAt: '2024-01-22T10:00:00Z'
            },
            {
              id: 'invite-2',
              email: 'pending2@techstart.com',
              role: 'admin',
              status: 'pending',
              sentAt: '2024-01-14T10:00:00Z',
              expiresAt: '2024-01-21T10:00:00Z'
            }
          ]
        }
      }).as('getInvitations')
      
      cy.wait('@getInvitations')
      
      // Check pending invitations
      cy.contains('pending1@techstart.com').should('be.visible')
      cy.contains('pending2@techstart.com').should('be.visible')
      
      // Resend invitation
      cy.intercept('POST', '**/api/team/invitations/invite-1/resend', {
        statusCode: 200,
        body: { success: true }
      }).as('resendInvite')
      
      cy.get('[data-invite-id="invite-1"]').find('button').contains(/resend/i).click()
      cy.wait('@resendInvite')
      
      cy.contains(/invitation.*resent/i).should('be.visible')
    })

    it('should cancel invitation', () => {
      cy.visit('/team/invitations')
      
      // Mock cancellation
      cy.intercept('DELETE', '**/api/team/invitations/invite-1', {
        statusCode: 200,
        body: { success: true }
      }).as('cancelInvite')
      
      cy.get('[data-invite-id="invite-1"]').find('button').contains(/cancel/i).click()
      
      // Confirm cancellation
      cy.contains('button', /confirm/i).click()
      cy.wait('@cancelInvite')
      
      // Check removed from list
      cy.get('[data-invite-id="invite-1"]').should('not.exist')
    })
  })

  describe('Role Management', () => {
    it('should display role capabilities', () => {
      cy.visit('/team/roles')
      
      // Check role descriptions
      cy.contains('Owner').should('be.visible')
      cy.contains(/full access/i).should('be.visible')
      
      cy.contains('Admin').should('be.visible')
      cy.contains(/manage.*team/i).should('be.visible')
      
      cy.contains('User').should('be.visible')
      cy.contains(/view.*upload/i).should('be.visible')
      
      cy.contains('Viewer').should('be.visible')
      cy.contains(/read.*only/i).should('be.visible')
    })

    it('should change member role', () => {
      cy.visit('/team')
      
      // Mock role change
      cy.intercept('PUT', '**/api/team/members/member-3/role', {
        statusCode: 200,
        body: {
          success: true,
          member: {
            id: 'member-3',
            name: 'Bob Wilson',
            role: 'admin'
          }
        }
      }).as('changeRole')
      
      // Find member and change role
      cy.get('[data-member-id="member-3"]')
        .find('select[name="role"]')
        .select('admin')
      
      cy.wait('@changeRole')
      
      // Check success
      cy.contains(/role.*updated/i).should('be.visible')
    })

    it('should prevent demoting last owner', () => {
      cy.visit('/team')
      
      // Try to change owner role
      cy.get('[data-member-id="member-1"]')
        .find('select[name="role"]')
        .should('be.disabled')
      
      // Or show warning
      cy.get('[data-member-id="member-1"]')
        .find('select[name="role"]')
        .select('admin')
      
      cy.contains(/must.*at least one owner/i).should('be.visible')
    })
  })

  describe('Team Member Actions', () => {
    it('should remove team member', () => {
      cy.visit('/team')
      
      // Mock removal
      cy.intercept('DELETE', '**/api/team/members/member-3', {
        statusCode: 200,
        body: { success: true }
      }).as('removeMember')
      
      // Remove member
      cy.get('[data-member-id="member-3"]')
        .find('button').contains(/remove/i).click()
      
      // Confirm removal
      cy.contains('button', /confirm.*remove/i).click()
      cy.wait('@removeMember')
      
      // Check removed
      cy.get('[data-member-id="member-3"]').should('not.exist')
      cy.contains(/member.*removed/i).should('be.visible')
    })

    it('should suspend team member', () => {
      cy.visit('/team')
      
      // Mock suspension
      cy.intercept('PUT', '**/api/team/members/member-2/suspend', {
        statusCode: 200,
        body: {
          success: true,
          member: {
            id: 'member-2',
            status: 'suspended'
          }
        }
      }).as('suspendMember')
      
      // Suspend member
      cy.get('[data-member-id="member-2"]')
        .find('button').contains(/suspend/i).click()
      
      // Confirm
      cy.contains('button', /confirm/i).click()
      cy.wait('@suspendMember')
      
      // Check suspended status
      cy.get('[data-member-id="member-2"]')
        .contains(/suspended/i).should('be.visible')
    })

    it('should reactivate suspended member', () => {
      cy.visit('/team')
      
      // Mock reactivation
      cy.intercept('PUT', '**/api/team/members/member-2/activate', {
        statusCode: 200,
        body: {
          success: true,
          member: {
            id: 'member-2',
            status: 'active'
          }
        }
      }).as('activateMember')
      
      // Reactivate
      cy.get('[data-member-id="member-2"]')
        .find('button').contains(/reactivate/i).click()
      
      cy.wait('@activateMember')
      
      // Check active status
      cy.get('[data-member-id="member-2"]')
        .contains(/active/i).should('be.visible')
    })
  })

  describe('Permission Testing', () => {
    it('should show actions based on user role', () => {
      // Set as regular user
      cy.window().then((win) => {
        win.localStorage.setItem('intellifill-auth', JSON.stringify({
          state: {
            user: { ...ownerUser, role: 'user' },
            company: company,
            tokens: { accessToken: 'user-token' },
            isAuthenticated: true
          }
        }))
      })
      
      cy.visit('/team')
      
      // User shouldn't see admin actions
      cy.contains('button', /invite/i).should('not.exist')
      cy.get('select[name="role"]').should('not.exist')
      cy.contains('button', /remove/i).should('not.exist')
    })

    it('should restrict admin panel to admins and owners', () => {
      // Try as viewer
      cy.window().then((win) => {
        win.localStorage.setItem('intellifill-auth', JSON.stringify({
          state: {
            user: { ...ownerUser, role: 'viewer' },
            company: company,
            tokens: { accessToken: 'viewer-token' },
            isAuthenticated: true
          }
        }))
      })
      
      cy.visit('/admin')
      
      // Should redirect or show unauthorized
      cy.url().should('not.include', '/admin')
      // OR
      cy.contains(/unauthorized|access denied/i).should('be.visible')
    })
  })

  describe('Team Activity', () => {
    it('should show team activity feed', () => {
      cy.visit('/team/activity')
      
      // Mock activity feed
      cy.intercept('GET', '**/api/team/activity', {
        statusCode: 200,
        body: {
          activities: [
            {
              id: 'activity-1',
              user: 'Jane Smith',
              action: 'uploaded',
              target: 'invoice.pdf',
              timestamp: '2024-01-20T10:00:00Z'
            },
            {
              id: 'activity-2',
              user: 'Bob Wilson',
              action: 'processed',
              target: '5 documents',
              timestamp: '2024-01-20T09:30:00Z'
            },
            {
              id: 'activity-3',
              user: 'John Doe',
              action: 'invited',
              target: 'newuser@techstart.com',
              timestamp: '2024-01-20T09:00:00Z'
            }
          ]
        }
      }).as('getActivity')
      
      cy.wait('@getActivity')
      
      // Check activity items
      cy.contains('Jane Smith uploaded invoice.pdf').should('be.visible')
      cy.contains('Bob Wilson processed 5 documents').should('be.visible')
      cy.contains('John Doe invited newuser@techstart.com').should('be.visible')
    })

    it('should filter activity by member', () => {
      cy.visit('/team/activity')
      
      // Filter by member
      cy.get('select[name="member"]').select('Jane Smith')
      
      // Only Jane's activities should show
      cy.contains('Jane Smith').should('be.visible')
      cy.contains('Bob Wilson').should('not.exist')
    })

    it('should filter activity by action type', () => {
      cy.visit('/team/activity')
      
      // Filter by uploads
      cy.get('select[name="action"]').select('uploads')
      
      // Only upload activities should show
      cy.contains('uploaded').should('be.visible')
      cy.contains('processed').should('not.exist')
      cy.contains('invited').should('not.exist')
    })
  })

  describe('Collaboration Features', () => {
    it('should share document with team member', () => {
      cy.visit('/documents/doc-123')
      
      // Click share button
      cy.contains('button', /share/i).click()
      
      // Select team members
      cy.get('input[type="checkbox"][value="member-2"]').check()
      cy.get('input[type="checkbox"][value="member-3"]').check()
      
      // Add message
      cy.get('textarea[name="message"]').type('Please review this invoice')
      
      // Mock share API
      cy.intercept('POST', '**/api/documents/doc-123/share', {
        statusCode: 200,
        body: { success: true }
      }).as('shareDoc')
      
      // Share
      cy.contains('button', /share.*document/i).click()
      cy.wait('@shareDoc')
      
      // Check success
      cy.contains(/shared.*2.*members/i).should('be.visible')
    })

    it('should show shared documents', () => {
      cy.visit('/documents/shared')
      
      // Mock shared documents
      cy.intercept('GET', '**/api/documents/shared', {
        statusCode: 200,
        body: {
          documents: [
            {
              id: 'doc-456',
              fileName: 'contract.pdf',
              sharedBy: 'Jane Smith',
              sharedAt: '2024-01-19T14:00:00Z',
              message: 'Need your approval'
            },
            {
              id: 'doc-789',
              fileName: 'proposal.docx',
              sharedBy: 'John Doe',
              sharedAt: '2024-01-18T10:00:00Z',
              message: 'FYI'
            }
          ]
        }
      }).as('getShared')
      
      cy.wait('@getShared')
      
      // Check shared documents
      cy.contains('contract.pdf').should('be.visible')
      cy.contains('Shared by Jane Smith').should('be.visible')
      cy.contains('Need your approval').should('be.visible')
    })

    it('should add comments to document', () => {
      cy.visit('/documents/doc-123')
      
      // Add comment
      cy.get('textarea[name="comment"]').type('Looks good, but please check the total amount')
      
      // Mock comment API
      cy.intercept('POST', '**/api/documents/doc-123/comments', {
        statusCode: 201,
        body: {
          comment: {
            id: 'comment-1',
            text: 'Looks good, but please check the total amount',
            author: 'Current User',
            createdAt: new Date().toISOString()
          }
        }
      }).as('addComment')
      
      cy.contains('button', /add.*comment/i).click()
      cy.wait('@addComment')
      
      // Check comment appears
      cy.contains('Looks good, but please check the total amount').should('be.visible')
    })

    it('should mention team members in comments', () => {
      cy.visit('/documents/doc-123')
      
      // Type comment with mention
      cy.get('textarea[name="comment"]').type('@Jane Smith please review')
      
      // Should show mention suggestions
      cy.contains('Jane Smith').should('be.visible')
      
      // Select mention
      cy.contains('Jane Smith').click()
      
      // Add comment
      cy.contains('button', /add.*comment/i).click()
      
      // Check mention is highlighted
      cy.get('.mention').contains('Jane Smith').should('be.visible')
    })
  })

  describe('Team Settings', () => {
    it('should configure team notifications', () => {
      cy.visit('/team/settings')
      
      // Toggle notification settings
      cy.get('input[name="emailOnInvite"]').check()
      cy.get('input[name="emailOnDocShare"]').check()
      cy.get('input[name="emailOnComment"]').uncheck()
      
      // Mock save settings
      cy.intercept('PUT', '**/api/team/settings', {
        statusCode: 200,
        body: { success: true }
      }).as('saveSettings')
      
      cy.contains('button', /save.*settings/i).click()
      cy.wait('@saveSettings')
      
      // Check saved
      cy.contains(/settings.*saved/i).should('be.visible')
    })

    it('should set team defaults', () => {
      cy.visit('/team/settings')
      
      // Set default role for new members
      cy.get('select[name="defaultRole"]').select('viewer')
      
      // Set auto-accept invitations
      cy.get('input[name="autoAcceptDomain"]').type('techstart.com')
      
      // Save
      cy.contains('button', /save/i).click()
      
      // Check confirmation
      cy.contains(/defaults.*updated/i).should('be.visible')
    })
  })
})