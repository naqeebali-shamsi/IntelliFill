/// <reference types="cypress" />

/**
 * Team Collaboration E2E Tests
 * 
 * Tests team management and collaboration features including:
 * - User invitation and onboarding
 * - Role-based access control (admin, manager, user)
 * - Document sharing and permissions
 * - Team activity monitoring
 * - Collaborative document review
 * - Team settings and preferences
 */

describe('Team Collaboration', () => {
  let adminUser: any
  let testCompany: any
  let teamMembers: any

  before(() => {
    cy.fixture('users').then((users) => {
      adminUser = users.testUser
      testCompany = users.companies[0]
      teamMembers = [
        {
          email: 'manager@testcompany.com',
          name: 'Jane Manager',
          role: 'manager'
        },
        {
          email: 'user1@testcompany.com',
          name: 'John User',
          role: 'user'
        },
        {
          email: 'user2@testcompany.com',
          name: 'Mary User',
          role: 'user'
        }
      ]
    })
  })

  beforeEach(() => {
    cy.loginViaApi(adminUser)
  })

  afterEach(() => {
    cy.clearAuth()
  })

  describe('Team Member Invitation', () => {
    beforeEach(() => {
      cy.visit('/team/members')
    })

    it('should invite new team member successfully', () => {
      cy.intercept('POST', '/api/team/invitations', {
        statusCode: 201,
        body: {
          invitationId: 'inv_123',
          email: teamMembers[0].email,
          role: teamMembers[0].role,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      }).as('sendInvitation')

      // Open invitation form
      cy.get('[data-cy="invite-member-button"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="invitation-modal"]')
        .should('be.visible')

      // Fill invitation form
      cy.get('[data-cy="invite-email-input"]')
        .type(teamMembers[0].email)

      cy.get('[data-cy="invite-name-input"]')
        .type(teamMembers[0].name)

      cy.get('[data-cy="invite-role-select"]')
        .click()
      cy.get(`[data-value="${teamMembers[0].role}"]`).click()

      cy.get('[data-cy="custom-message-textarea"]')
        .type('Welcome to our team! Looking forward to working together.')

      // Send invitation
      cy.get('[data-cy="send-invitation-button"]').click()

      cy.wait('@sendInvitation')

      // Verify success
      cy.get('[data-cy="invitation-sent-notification"]')
        .should('be.visible')
        .should('contain', 'Invitation sent successfully')

      cy.get('[data-cy="invitation-modal"]')
        .should('not.exist')

      // Verify invitation appears in pending list
      cy.get('[data-cy="pending-invitations"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="pending-invitation"]')
            .should('contain', teamMembers[0].email)
            .should('contain', teamMembers[0].role)
        })
    })

    it('should validate invitation form fields', () => {
      cy.get('[data-cy="invite-member-button"]').click()

      // Try to send without required fields
      cy.get('[data-cy="send-invitation-button"]').click()

      cy.get('[data-cy="email-required-error"]')
        .should('be.visible')
        .should('contain', 'Email is required')

      cy.get('[data-cy="role-required-error"]')
        .should('be.visible')
        .should('contain', 'Role is required')

      // Test invalid email
      cy.get('[data-cy="invite-email-input"]')
        .type('invalid-email')
        .blur()

      cy.get('[data-cy="email-format-error"]')
        .should('be.visible')
        .should('contain', 'Please enter a valid email address')
    })

    it('should prevent duplicate invitations', () => {
      cy.intercept('POST', '/api/team/invitations', {
        statusCode: 409,
        body: { error: 'User already invited or exists' }
      }).as('duplicateInvitation')

      cy.get('[data-cy="invite-member-button"]').click()

      cy.get('[data-cy="invite-email-input"]')
        .type('existing@testcompany.com')
      cy.get('[data-cy="invite-role-select"]')
        .click()
      cy.get('[data-value="user"]').click()

      cy.get('[data-cy="send-invitation-button"]').click()

      cy.wait('@duplicateInvitation')

      cy.get('[data-cy="duplicate-invitation-error"]')
        .should('be.visible')
        .should('contain', 'User already invited or exists')
    })

    it('should send bulk invitations', () => {
      cy.intercept('POST', '/api/team/invitations/bulk', {
        statusCode: 201,
        body: {
          successful: teamMembers.length,
          failed: 0,
          invitations: teamMembers.map((member, index) => ({
            invitationId: `inv_${index + 1}`,
            email: member.email,
            role: member.role,
            status: 'pending'
          }))
        }
      }).as('bulkInvitations')

      cy.get('[data-cy="bulk-invite-button"]').click()

      cy.get('[data-cy="bulk-invitation-modal"]')
        .should('be.visible')

      // Upload CSV or paste emails
      cy.get('[data-cy="bulk-emails-textarea"]')
        .type(teamMembers.map(m => `${m.email},${m.name},${m.role}`).join('\n'))

      cy.get('[data-cy="send-bulk-invitations-button"]').click()

      cy.wait('@bulkInvitations')

      cy.get('[data-cy="bulk-invitation-success"]')
        .should('be.visible')
        .should('contain', `${teamMembers.length} invitations sent`)
    })
  })

  describe('Invitation Acceptance Flow', () => {
    it('should accept invitation and complete onboarding', () => {
      // Mock invitation token
      const invitationToken = 'inv_token_123'
      
      cy.intercept('GET', `/api/invitations/${invitationToken}`, {
        statusCode: 200,
        body: {
          invitationId: 'inv_123',
          email: teamMembers[0].email,
          companyName: testCompany.name,
          role: teamMembers[0].role,
          invitedBy: adminUser.name,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      }).as('getInvitation')

      cy.intercept('POST', `/api/invitations/${invitationToken}/accept`, {
        statusCode: 200,
        body: {
          user: {
            id: 'user_new',
            email: teamMembers[0].email,
            name: teamMembers[0].name,
            role: teamMembers[0].role
          },
          company: testCompany,
          token: 'new_user_token'
        }
      }).as('acceptInvitation')

      cy.clearAuth()
      cy.visit(`/invitations/${invitationToken}`)

      cy.wait('@getInvitation')

      // Verify invitation details
      cy.get('[data-cy="invitation-details"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="company-name"]').should('contain', testCompany.name)
          cy.get('[data-cy="invited-by"]').should('contain', adminUser.name)
          cy.get('[data-cy="role"]').should('contain', teamMembers[0].role)
        })

      // Complete user profile
      cy.get('[data-cy="user-name-input"]')
        .type(teamMembers[0].name)

      cy.get('[data-cy="password-input"]')
        .type('SecurePass123!')

      cy.get('[data-cy="password-confirm-input"]')
        .type('SecurePass123!')

      cy.get('[data-cy="accept-invitation-button"]').click()

      cy.wait('@acceptInvitation')

      // Should redirect to onboarding
      cy.url().should('include', '/onboarding')

      // Verify user is authenticated
      cy.checkAuthState(true)

      cy.get('[data-cy="welcome-message"]')
        .should('be.visible')
        .should('contain', `Welcome to ${testCompany.name}`)
    })

    it('should handle expired invitation', () => {
      const expiredToken = 'expired_token_123'

      cy.intercept('GET', `/api/invitations/${expiredToken}`, {
        statusCode: 410,
        body: { error: 'Invitation expired' }
      }).as('expiredInvitation')

      cy.clearAuth()
      cy.visit(`/invitations/${expiredToken}`)

      cy.wait('@expiredInvitation')

      cy.get('[data-cy="invitation-expired"]')
        .should('be.visible')
        .should('contain', 'This invitation has expired')

      cy.get('[data-cy="request-new-invitation-button"]')
        .should('be.visible')
    })

    it('should handle invalid invitation token', () => {
      const invalidToken = 'invalid_token_123'

      cy.intercept('GET', `/api/invitations/${invalidToken}`, {
        statusCode: 404,
        body: { error: 'Invitation not found' }
      }).as('invalidInvitation')

      cy.clearAuth()
      cy.visit(`/invitations/${invalidToken}`)

      cy.wait('@invalidInvitation')

      cy.get('[data-cy="invitation-not-found"]')
        .should('be.visible')
        .should('contain', 'Invitation not found')
    })
  })

  describe('Role-Based Access Control', () => {
    beforeEach(() => {
      cy.visit('/team/members')
    })

    it('should display proper permissions for admin role', () => {
      // Admin should see all management options
      cy.get('[data-cy="invite-member-button"]')
        .should('be.visible')

      cy.get('[data-cy="bulk-invite-button"]')
        .should('be.visible')

      cy.get('[data-cy="team-settings-button"]')
        .should('be.visible')

      // Should see all team members
      cy.get('[data-cy="team-member-list"]')
        .should('be.visible')

      cy.get('[data-cy="team-member"]')
        .first()
        .within(() => {
          cy.get('[data-cy="edit-role-button"]').should('be.visible')
          cy.get('[data-cy="remove-member-button"]').should('be.visible')
        })
    })

    it('should restrict manager permissions appropriately', () => {
      cy.fixture('users').then((users) => {
        const managerUser = users.regularUser

        cy.loginViaApi({ ...managerUser, role: 'manager' })
        cy.visit('/team/members')

        // Manager can invite but with limited roles
        cy.get('[data-cy="invite-member-button"]').should('be.visible')

        cy.get('[data-cy="invite-member-button"]').click()
        cy.get('[data-cy="invite-role-select"]').click()

        // Should not see admin role option
        cy.get('[data-value="admin"]').should('not.exist')
        cy.get('[data-value="manager"]').should('be.visible')
        cy.get('[data-value="user"]').should('be.visible')

        // Cannot access team settings
        cy.get('[data-cy="team-settings-button"]')
          .should('not.exist')
      })
    })

    it('should restrict user permissions to view-only', () => {
      cy.fixture('users').then((users) => {
        const regularUser = users.regularUser

        cy.loginViaApi(regularUser)
        cy.visit('/team/members')

        // User cannot invite or manage
        cy.get('[data-cy="invite-member-button"]')
          .should('not.exist')

        cy.get('[data-cy="team-settings-button"]')
          .should('not.exist')

        // Can only view team members (no management actions)
        cy.get('[data-cy="team-member-list"]')
          .should('be.visible')

        cy.get('[data-cy="edit-role-button"]')
          .should('not.exist')

        cy.get('[data-cy="remove-member-button"]')
          .should('not.exist')
      })
    })

    it('should enforce document access based on roles', () => {
      cy.visit('/documents')

      // Admin should see all documents
      cy.get('[data-cy="all-documents-tab"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="document-item"]')
        .should('have.length.greaterThan', 0)

      // Should see admin actions
      cy.get('[data-cy="document-item"]')
        .first()
        .within(() => {
          cy.get('[data-cy="delete-document-button"]').should('be.visible')
          cy.get('[data-cy="change-permissions-button"]').should('be.visible')
        })
    })
  })

  describe('Document Sharing and Permissions', () => {
    beforeEach(() => {
      cy.visit('/documents/doc_123')
    })

    it('should share document with team members', () => {
      cy.intercept('GET', '/api/team/members', {
        statusCode: 200,
        body: {
          members: teamMembers.map((member, index) => ({
            id: `user_${index + 1}`,
            ...member,
            status: 'active'
          }))
        }
      }).as('getTeamMembers')

      cy.intercept('POST', '/api/documents/doc_123/share', {
        statusCode: 200,
        body: { success: true }
      }).as('shareDocument')

      cy.get('[data-cy="share-document-button"]')
        .should('be.visible')
        .click()

      cy.get('[data-cy="share-modal"]')
        .should('be.visible')

      cy.wait('@getTeamMembers')

      // Select team members to share with
      cy.get('[data-cy="team-member-list"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="member-checkbox"]')
            .eq(0)
            .check()
          
          cy.get('[data-cy="member-checkbox"]')
            .eq(1)
            .check()
        })

      // Set permissions
      cy.get('[data-cy="permission-level-select"]')
        .select('view')

      cy.get('[data-cy="share-message-textarea"]')
        .type('Please review this document')

      cy.get('[data-cy="send-share-button"]').click()

      cy.wait('@shareDocument')

      cy.get('[data-cy="document-shared-notification"]')
        .should('be.visible')
        .should('contain', 'Document shared successfully')
    })

    it('should manage document permissions', () => {
      cy.intercept('GET', '/api/documents/doc_123/permissions', {
        statusCode: 200,
        body: {
          permissions: [
            {
              userId: 'user_1',
              userName: 'Jane Manager',
              permission: 'edit',
              sharedAt: new Date().toISOString()
            },
            {
              userId: 'user_2',
              userName: 'John User',
              permission: 'view',
              sharedAt: new Date().toISOString()
            }
          ]
        }
      }).as('getPermissions')

      cy.get('[data-cy="manage-permissions-button"]').click()

      cy.wait('@getPermissions')

      cy.get('[data-cy="permissions-modal"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="permission-item"]').should('have.length', 2)

          // Change permission level
          cy.get('[data-cy="permission-item"]')
            .eq(1)
            .within(() => {
              cy.get('[data-cy="permission-select"]')
                .select('edit')
            })

          // Remove permission
          cy.get('[data-cy="permission-item"]')
            .eq(0)
            .within(() => {
              cy.get('[data-cy="remove-permission-button"]').click()
            })
        })

      cy.get('[data-cy="save-permissions-button"]').click()

      cy.get('[data-cy="permissions-updated-notification"]')
        .should('be.visible')
    })

    it('should handle permission-based document access', () => {
      // Test as user with view-only permission
      cy.fixture('users').then((users) => {
        const viewOnlyUser = users.regularUser

        cy.loginViaApi(viewOnlyUser)
        cy.visit('/documents/doc_123')

        // Should see document but not edit options
        cy.get('[data-cy="document-content"]')
          .should('be.visible')

        cy.get('[data-cy="edit-document-button"]')
          .should('not.exist')

        cy.get('[data-cy="delete-document-button"]')
          .should('not.exist')

        // Should see view-only indicator
        cy.get('[data-cy="permission-indicator"]')
          .should('be.visible')
          .should('contain', 'View Only')
      })
    })
  })

  describe('Team Activity Monitoring', () => {
    beforeEach(() => {
      cy.visit('/team/activity')
    })

    it('should display team activity feed', () => {
      cy.intercept('GET', '/api/team/activity', {
        statusCode: 200,
        body: {
          activities: [
            {
              id: 'activity_1',
              type: 'document_processed',
              user: 'Jane Manager',
              action: 'processed document',
              target: 'employee-form.pdf',
              timestamp: new Date().toISOString()
            },
            {
              id: 'activity_2',
              type: 'member_invited',
              user: 'Admin User',
              action: 'invited team member',
              target: 'new@company.com',
              timestamp: new Date(Date.now() - 3600000).toISOString()
            }
          ]
        }
      }).as('getActivity')

      cy.wait('@getActivity')

      cy.get('[data-cy="activity-feed"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="activity-item"]').should('have.length', 2)

          cy.get('[data-cy="activity-item"]')
            .first()
            .should('contain', 'Jane Manager')
            .should('contain', 'processed document')
            .should('contain', 'employee-form.pdf')
        })
    })

    it('should filter activity by type', () => {
      cy.get('[data-cy="activity-filter"]')
        .should('be.visible')
        .select('document_activity')

      cy.get('[data-cy="activity-item"]')
        .should('be.visible')
        .should('contain', 'document')
    })

    it('should filter activity by date range', () => {
      cy.get('[data-cy="date-range-picker"]').click()

      cy.get('[data-cy="start-date"]')
        .type('2024-01-01')

      cy.get('[data-cy="end-date"]')
        .type('2024-01-31')

      cy.get('[data-cy="apply-date-filter"]').click()

      cy.get('[data-cy="activity-item"]')
        .should('be.visible')
    })

    it('should export activity report', () => {
      cy.intercept('GET', '/api/team/activity/export', {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename=team-activity.csv'
        },
        body: 'timestamp,user,action,target\n2024-01-01,Jane,processed,doc.pdf'
      }).as('exportActivity')

      cy.get('[data-cy="export-activity-button"]').click()

      cy.wait('@exportActivity')

      cy.get('[data-cy="export-success-notification"]')
        .should('be.visible')
    })
  })

  describe('Collaborative Document Review', () => {
    beforeEach(() => {
      cy.visit('/documents/doc_123/review')
    })

    it('should add comments to document fields', () => {
      cy.intercept('POST', '/api/documents/doc_123/comments', {
        statusCode: 201,
        body: {
          commentId: 'comment_1',
          fieldName: 'email',
          text: 'Please verify this email address',
          author: adminUser.name,
          timestamp: new Date().toISOString()
        }
      }).as('addComment')

      cy.get('[data-cy="field-email"]')
        .within(() => {
          cy.get('[data-cy="add-comment-button"]').click()
        })

      cy.get('[data-cy="comment-modal"]')
        .should('be.visible')

      cy.get('[data-cy="comment-textarea"]')
        .type('Please verify this email address')

      cy.get('[data-cy="submit-comment-button"]').click()

      cy.wait('@addComment')

      cy.get('[data-cy="comment-added-notification"]')
        .should('be.visible')

      // Comment should appear
      cy.get('[data-cy="field-email"]')
        .within(() => {
          cy.get('[data-cy="comment-indicator"]').should('be.visible')
          cy.get('[data-cy="comment-count"]').should('contain', '1')
        })
    })

    it('should resolve field validation issues collaboratively', () => {
      cy.get('[data-cy="field-phone"]')
        .within(() => {
          cy.get('[data-cy="validation-error"]')
            .should('be.visible')
            .should('contain', 'Invalid format')

          cy.get('[data-cy="suggest-fix-button"]').click()
        })

      cy.get('[data-cy="suggestion-modal"]')
        .should('be.visible')

      cy.get('[data-cy="suggested-value"]')
        .clear()
        .type('(555) 123-4567')

      cy.get('[data-cy="suggestion-note"]')
        .type('Formatted phone number correctly')

      cy.get('[data-cy="submit-suggestion-button"]').click()

      cy.get('[data-cy="suggestion-sent-notification"]')
        .should('be.visible')
    })

    it('should track document review status', () => {
      cy.intercept('GET', '/api/documents/doc_123/review-status', {
        statusCode: 200,
        body: {
          status: 'in_review',
          reviewers: [
            { name: 'Jane Manager', status: 'approved' },
            { name: 'John User', status: 'pending' }
          ],
          requiredApprovals: 2,
          currentApprovals: 1
        }
      }).as('getReviewStatus')

      cy.wait('@getReviewStatus')

      cy.get('[data-cy="review-status"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="approval-progress"]')
            .should('contain', '1 of 2 approvals')

          cy.get('[data-cy="reviewer-status"]')
            .should('contain', 'Jane Manager')
            .should('contain', 'approved')

          cy.get('[data-cy="reviewer-status"]')
            .should('contain', 'John User')
            .should('contain', 'pending')
        })
    })
  })

  describe('Team Settings and Preferences', () => {
    beforeEach(() => {
      cy.visit('/team/settings')
    })

    it('should configure team notification preferences', () => {
      cy.intercept('PUT', '/api/team/settings', {
        statusCode: 200,
        body: { success: true }
      }).as('updateTeamSettings')

      cy.get('[data-cy="notification-settings"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="email-notifications"]').check()
          cy.get('[data-cy="slack-notifications"]').check()
          cy.get('[data-cy="document-processed-notifications"]').check()
        })

      cy.get('[data-cy="save-settings-button"]').click()

      cy.wait('@updateTeamSettings')

      cy.get('[data-cy="settings-saved-notification"]')
        .should('be.visible')
    })

    it('should configure default roles and permissions', () => {
      cy.get('[data-cy="default-permissions"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="default-role-select"]')
            .select('user')

          cy.get('[data-cy="auto-approve-documents"]').check()
          cy.get('[data-cy="require-review"]').uncheck()
        })

      cy.get('[data-cy="save-settings-button"]').click()

      cy.get('[data-cy="settings-saved-notification"]')
        .should('be.visible')
    })

    it('should manage team integrations', () => {
      cy.get('[data-cy="integrations-section"]')
        .should('be.visible')

      cy.get('[data-cy="slack-integration"]')
        .within(() => {
          cy.get('[data-cy="connect-slack-button"]').click()
        })

      // Mock OAuth flow
      cy.get('[data-cy="slack-auth-modal"]')
        .should('be.visible')

      cy.get('[data-cy="authorize-slack-button"]').click()

      cy.get('[data-cy="integration-connected-notification"]')
        .should('be.visible')
        .should('contain', 'Slack connected successfully')
    })
  })

  describe('Team Performance Analytics', () => {
    beforeEach(() => {
      cy.visit('/team/analytics')
    })

    it('should display team productivity metrics', () => {
      cy.intercept('GET', '/api/team/analytics', {
        statusCode: 200,
        body: {
          documentsProcessed: 150,
          averageProcessingTime: 2.5,
          teamEfficiency: 87,
          topPerformers: [
            { name: 'Jane Manager', documentsProcessed: 45 },
            { name: 'John User', documentsProcessed: 38 }
          ]
        }
      }).as('getAnalytics')

      cy.wait('@getAnalytics')

      cy.get('[data-cy="productivity-metrics"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="documents-processed"]')
            .should('contain', '150')

          cy.get('[data-cy="average-processing-time"]')
            .should('contain', '2.5 minutes')

          cy.get('[data-cy="team-efficiency"]')
            .should('contain', '87%')
        })

      cy.get('[data-cy="top-performers"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="performer-item"]')
            .should('have.length', 2)
            .first()
            .should('contain', 'Jane Manager')
            .should('contain', '45')
        })
    })

    it('should display team collaboration statistics', () => {
      cy.get('[data-cy="collaboration-metrics"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-cy="shared-documents"]').should('be.visible')
          cy.get('[data-cy="comments-added"]').should('be.visible')
          cy.get('[data-cy="reviews-completed"]').should('be.visible')
        })
    })

    it('should export team performance report', () => {
      cy.intercept('GET', '/api/team/analytics/export', {
        statusCode: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename=team-report.pdf'
        }
      }).as('exportReport')

      cy.get('[data-cy="export-report-button"]').click()

      cy.wait('@exportReport')

      cy.get('[data-cy="report-exported-notification"]')
        .should('be.visible')
    })
  })
})