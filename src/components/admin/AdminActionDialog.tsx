import { ReactNode } from 'react';
import { AdminModalForm } from './AdminModalForm';

export function AdminActionDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmDisabled = false,
  isLoading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AdminModalForm
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={confirmDisabled || isLoading}>
            {isLoading ? 'Procesando...' : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </AdminModalForm>
  );
}
