import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLogo } from '../components/common/AppLogo';

describe('AppLogo', () => {
  it('renders a symbol-only SVG with no embedded text elements', () => {
    const { container } = render(<AppLogo />);
    const svg = screen.getByRole('img', { name: 'FoodFactory ERP' });
    expect(svg).toBeTruthy();
    expect(container.querySelector('text')).toBeNull();
    expect(container.querySelector('tspan')).toBeNull();
    expect(svg.textContent?.trim()).toBe('');
  });

  it('supports decorative mode without redundant screen-reader announcements', () => {
    const { container } = render(<AppLogo decorative />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('role')).toBeNull();
  });

  it('supports white and mono variants and optional external wordmark', () => {
    const { container } = render(<AppLogo variant="white" size="lg" showWordmark />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('h-11')).toBe(true);
    expect(screen.getByText('FoodFactory ERP')).toBeTruthy();
  });
});
