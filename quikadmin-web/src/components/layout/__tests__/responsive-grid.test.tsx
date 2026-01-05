/**
 * Phase 1 Component Tests - ResponsiveGrid Component
 * Tests for responsive grid layouts
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsiveGrid } from '@/components/layout/responsive-grid';

describe('ResponsiveGrid Component', () => {
  describe('Basic Rendering', () => {
    it('renders grid container', () => {
      render(
        <ResponsiveGrid cols={2}>
          <div>Item 1</div>
          <div>Item 2</div>
        </ResponsiveGrid>
      );
      expect(screen.getByText(/item 1/i)).toBeInTheDocument();
      expect(screen.getByText(/item 2/i)).toBeInTheDocument();
    });

    it('applies column classes', () => {
      const { container } = render(
        <ResponsiveGrid cols={3}>
          <div>Item</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
    });

    it('applies gap classes', () => {
      const { container } = render(
        <ResponsiveGrid cols={2} gap="lg">
          <div>Item</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      expect(grid).toHaveClass('gap-6');
    });
  });

  describe('Responsive Columns', () => {
    it('applies responsive column classes', () => {
      const { container } = render(
        <ResponsiveGrid cols={2}>
          <div>Item</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    });
  });

  describe('Presets', () => {
    it('applies stats preset classes', () => {
      const { container } = render(
        <ResponsiveGrid preset="stats">
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
          <div>Item 4</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4', 'gap-4');
    });

    it('applies cards preset classes', () => {
      const { container } = render(
        <ResponsiveGrid preset="cards">
          <div>Card 1</div>
          <div>Card 2</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      expect(grid).toHaveClass(
        'grid-cols-1',
        'sm:grid-cols-2',
        'lg:grid-cols-3',
        'xl:grid-cols-4',
        'gap-6'
      );
    });

    it('applies sidebar preset classes', () => {
      const { container } = render(
        <ResponsiveGrid preset="sidebar">
          <div>Main content</div>
          <div>Sidebar</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      expect(grid).toHaveClass('grid-cols-1', 'lg:grid-cols-[2fr_1fr]', 'gap-8');
    });

    it('applies twoColumn preset classes', () => {
      const { container } = render(
        <ResponsiveGrid preset="twoColumn">
          <div>Column 1</div>
          <div>Column 2</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      expect(grid).toHaveClass('grid-cols-1', 'lg:grid-cols-2', 'gap-6');
    });

    it('preset overrides cols and gap props', () => {
      const { container } = render(
        <ResponsiveGrid preset="stats" cols={6} gap="xl">
          <div>Item</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      // Should use preset classes, not cols/gap
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4', 'gap-4');
      expect(grid).not.toHaveClass('grid-cols-6');
      expect(grid).not.toHaveClass('gap-8');
    });

    it('allows className to override preset classes', () => {
      const { container } = render(
        <ResponsiveGrid preset="stats" className="gap-10">
          <div>Item</div>
        </ResponsiveGrid>
      );
      const grid = container.querySelector('[data-slot="responsive-grid"]');
      expect(grid).toHaveClass('gap-10');
    });
  });
});
