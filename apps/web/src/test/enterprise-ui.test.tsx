import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Pagination } from '../components/common/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/common/StateViews';

describe('Enterprise Design System Common Components', () => {
  it('renders PageHeader with title, description, and action slot', () => {
    render(
      <PageHeader
        title="Production Costing"
        description="Standard vs actual batch cost analysis"
        actions={<button type="button">Export CSV</button>}
      />,
    );

    expect(screen.getByText('Production Costing')).toBeTruthy();
    expect(screen.getByText('Standard vs actual batch cost analysis')).toBeTruthy();
    expect(screen.getByText('Export CSV')).toBeTruthy();
  });

  it('renders KpiCard with label, value, and sublabel', () => {
    render(<KpiCard label="Issued Invoice Value" value="₹1,25,000.00" sublabel="12 invoices" tone="info" />);
    expect(screen.getByText('Issued Invoice Value')).toBeTruthy();
    expect(screen.getByText('₹1,25,000.00')).toBeTruthy();
    expect(screen.getByText('12 invoices')).toBeTruthy();
  });

  it('renders StatusBadge with accessible text labels', () => {
    render(
      <div>
        <StatusBadge status="APPROVED" />
        <StatusBadge status="QUARANTINE" />
        <StatusBadge status="REJECTED" />
      </div>,
    );
    expect(screen.getByText('APPROVED')).toBeTruthy();
    expect(screen.getByText('QUARANTINE')).toBeTruthy();
    expect(screen.getByText('REJECTED')).toBeTruthy();
  });

  it('ConfirmDialog triggers onConfirm and onCancel appropriately', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Cancel Sales Order"
        description="Are you sure you want to cancel this order?"
        confirmLabel="Yes, Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByText('Yes, Cancel'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Pagination disables Prev on first page and invokes onPageChange on Next', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalPages={3} total={25} onPageChange={onPageChange} />);

    const prevBtn = screen.getByLabelText('Previous page') as HTMLButtonElement;
    const nextBtn = screen.getByLabelText('Next page') as HTMLButtonElement;

    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders LoadingState, EmptyState, and ErrorState with retry', () => {
    const onRetry = vi.fn();
    render(
      <div>
        <LoadingState label="Loading batches..." />
        <EmptyState title="No batches" description="No batches found" />
        <ErrorState title="Load error" message="Network timeout" onRetry={onRetry} />
      </div>,
    );

    expect(screen.getByText('Loading batches...')).toBeTruthy();
    expect(screen.getByText('No batches')).toBeTruthy();
    expect(screen.getByText('Network timeout')).toBeTruthy();

    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
