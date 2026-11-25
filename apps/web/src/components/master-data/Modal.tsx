import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '../common/Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#103B28]/45 p-4 backdrop-blur-[1px]">
      <div
        className={`flex max-h-[90vh] w-full ${maxWidth} flex-col rounded-lg border border-[#E1E7DD] bg-white shadow-xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#E1E7DD] px-6 py-4">
          <h2 className="text-base font-semibold text-[#24352A]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1 text-[#8A958C] hover:bg-[#EAF1E8] hover:text-[#24352A]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-[#C58A25]/15 p-2 text-[#C58A25]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm text-[#66756A]">{message}</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const FormField: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, error, children }) => (
  <div className="space-y-1">
    <label className="block text-xs font-medium text-[#24352A]">
      {label} {required && <span className="text-[#C74440]">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-[#C74440]">{error}</p>}
  </div>
);

export const inputClassName =
  'w-full rounded-md border border-[#E1E7DD] bg-[#FAFBF8] px-3 py-1.5 text-sm text-[#24352A] placeholder:text-[#8A958C] focus:border-[#245C3A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#245C3A] disabled:bg-[#F4F0E4]/60';
