/**
 * Phase 1 Component Tests - Card Component
 * Tests for Card variants and composition
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

describe('Card Component', () => {
  describe('Basic Rendering', () => {
    it('renders card', () => {
      render(<Card>Card content</Card>)
      expect(screen.getByText(/card content/i)).toBeInTheDocument()
    })

    it('renders card header', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
          </CardHeader>
        </Card>
      )
      expect(screen.getByText(/title/i)).toBeInTheDocument()
    })

    it('renders card content', () => {
      render(
        <Card>
          <CardContent>Content</CardContent>
        </Card>
      )
      expect(screen.getByText(/content/i)).toBeInTheDocument()
    })

    it('renders card footer', () => {
      render(
        <Card>
          <CardFooter>Footer</CardFooter>
        </Card>
      )
      expect(screen.getByText(/footer/i)).toBeInTheDocument()
    })
  })

  describe('Composition', () => {
    it('renders complete card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      )
      expect(screen.getByText(/title/i)).toBeInTheDocument()
      expect(screen.getByText(/description/i)).toBeInTheDocument()
      expect(screen.getByText(/content/i)).toBeInTheDocument()
      expect(screen.getByText(/footer/i)).toBeInTheDocument()
    })
  })
})
