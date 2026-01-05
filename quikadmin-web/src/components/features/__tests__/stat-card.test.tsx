/**
 * StatCard Component Unit Tests
 *
 * Tests for the unified StatCard component covering:
 * - Basic rendering
 * - Loading state
 * - Variant colors
 * - Animation props
 * - Accessibility
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatCard, StatCardProps } from '../stat-card';
import { FileText, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      // Extract non-DOM props
      const { variants, initial, animate, transition, ...domProps } = props;
      return (
        <div data-testid="motion-div" data-delay={transition?.delay} {...domProps}>
          {children}
        </div>
      );
    },
  },
}));

const defaultProps: StatCardProps = {
  title: 'Total Documents',
  value: 42,
  icon: FileText,
};

describe('StatCard', () => {
  describe('Basic Rendering', () => {
    it('renders title correctly', () => {
      render(<StatCard {...defaultProps} />);
      expect(screen.getByText('Total Documents')).toBeInTheDocument();
    });

    it('renders value correctly', () => {
      render(<StatCard {...defaultProps} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders string value correctly', () => {
      render(<StatCard {...defaultProps} value="100+" />);
      expect(screen.getByText('100+')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(<StatCard {...defaultProps} description="Uploaded this month" />);
      expect(screen.getByText('Uploaded this month')).toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      render(<StatCard {...defaultProps} />);
      expect(screen.queryByText('Uploaded this month')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows skeleton when loading is true', () => {
      render(<StatCard {...defaultProps} loading={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading statistic...')).toBeInTheDocument();
    });

    it('hides content when loading is true', () => {
      render(<StatCard {...defaultProps} loading={true} />);
      expect(screen.queryByText('Total Documents')).not.toBeInTheDocument();
      expect(screen.queryByText('42')).not.toBeInTheDocument();
    });

    it('skeleton has animate-pulse classes', () => {
      render(<StatCard {...defaultProps} loading={true} data-testid="loading-card" />);
      const skeleton = screen.getByTestId('loading-card');
      // Check for pulse elements within skeleton
      const pulseElements = skeleton.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('shows content when loading is false', () => {
      render(<StatCard {...defaultProps} loading={false} />);
      expect(screen.getByText('Total Documents')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  describe('Variant Rendering', () => {
    it('renders default variant with primary colors', () => {
      render(<StatCard {...defaultProps} variant="default" data-testid="default-card" />);
      const card = screen.getByTestId('default-card');
      expect(card).toBeInTheDocument();
    });

    it('renders success variant with green colors', () => {
      render(
        <StatCard
          title="Completed"
          value={38}
          icon={CheckCircle}
          variant="success"
          data-testid="success-card"
        />
      );
      const card = screen.getByTestId('success-card');
      expect(card).toBeInTheDocument();
      // Check that success color classes are applied
      expect(card.innerHTML).toContain('emerald');
    });

    it('renders warning variant with amber colors', () => {
      render(
        <StatCard
          title="Pending"
          value={5}
          icon={AlertTriangle}
          variant="warning"
          data-testid="warning-card"
        />
      );
      const card = screen.getByTestId('warning-card');
      expect(card).toBeInTheDocument();
      expect(card.innerHTML).toContain('amber');
    });

    it('renders error variant with red colors', () => {
      render(
        <StatCard
          title="Failed"
          value={2}
          icon={XCircle}
          variant="error"
          data-testid="error-card"
        />
      );
      const card = screen.getByTestId('error-card');
      expect(card).toBeInTheDocument();
      expect(card.innerHTML).toContain('red');
    });
  });

  describe('Animation Props', () => {
    it('applies animationDelay to transition', () => {
      render(<StatCard {...defaultProps} animationDelay={0.3} data-testid="animated-card" />);
      const card = screen.getByTestId('animated-card');
      // Check that the card has data-delay attribute from the mock
      expect(card).toHaveAttribute('data-delay', '0.3');
    });

    it('defaults animationDelay to 0', () => {
      render(<StatCard {...defaultProps} data-testid="default-delay-card" />);
      const card = screen.getByTestId('default-delay-card');
      expect(card).toHaveAttribute('data-delay', '0');
    });
  });

  describe('Accessibility', () => {
    it('decorative icon has aria-hidden', () => {
      render(<StatCard {...defaultProps} data-testid="a11y-card" />);
      const card = screen.getByTestId('a11y-card');
      const ariaHiddenElements = card.querySelectorAll('[aria-hidden="true"]');
      expect(ariaHiddenElements.length).toBeGreaterThan(0);
    });

    it('data-testid is applied correctly', () => {
      render(<StatCard {...defaultProps} data-testid="custom-test-id" />);
      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('loading skeleton has proper ARIA attributes', () => {
      render(<StatCard {...defaultProps} loading={true} />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toHaveAttribute('aria-label', 'Loading statistic...');
    });
  });

  describe('className Passthrough', () => {
    it('merges custom className with component classes', () => {
      render(<StatCard {...defaultProps} className="custom-class" data-testid="custom-card" />);
      const card = screen.getByTestId('custom-card');
      expect(card).toHaveClass('custom-class');
      expect(card).toHaveClass('glass-panel');
    });

    it('applies className to skeleton when loading', () => {
      render(
        <StatCard
          {...defaultProps}
          loading={true}
          className="custom-skeleton-class"
          data-testid="loading-custom"
        />
      );
      const skeleton = screen.getByTestId('loading-custom');
      expect(skeleton).toHaveClass('custom-skeleton-class');
    });
  });

  describe('Edge Cases', () => {
    it('handles zero value', () => {
      render(<StatCard {...defaultProps} value={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles large numbers', () => {
      render(<StatCard {...defaultProps} value={1234567} />);
      expect(screen.getByText('1234567')).toBeInTheDocument();
    });

    it('handles empty description', () => {
      render(<StatCard {...defaultProps} description="" />);
      // Empty description should not render the p element
      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
    });
  });
});
