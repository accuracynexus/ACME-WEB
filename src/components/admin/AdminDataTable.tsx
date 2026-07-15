import { ReactNode } from 'react';
import { TableSkeleton } from '../shared/Skeleton';

export interface AdminDataTableColumn<TRecord> {
  id: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (record: TRecord) => ReactNode;
}

export function AdminDataTable<TRecord>({
  columns,
  rows,
  getRowId,
  emptyMessage = 'No hay registros para mostrar.',
  loading = false,
  skeletonRows = 5,
}: {
  columns: AdminDataTableColumn<TRecord>[];
  rows: TRecord[];
  getRowId: (record: TRecord) => string;
  emptyMessage?: string;
  loading?: boolean;
  skeletonRows?: number;
}) {
  if (loading) {
    return <TableSkeleton rows={skeletonRows} columns={Math.max(1, columns.length)} />;
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '40px 20px' }}>
        <div className="empty-state__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
        </div>
        <p className="empty-state__desc">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} data-align={column.align} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              {columns.map((column) => (
                <td key={column.id} data-align={column.align}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
