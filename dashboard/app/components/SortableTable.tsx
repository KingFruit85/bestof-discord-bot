import type { ReactNode } from 'react';
import { buildHref } from '../../lib/format';
import { applySort, formatSortParam, nextSort, type Column, type SortState } from '../../lib/sort';

export interface TableColumn<T> extends Column<T> {
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

/**
 * A table whose sortable headers are plain links that set this table's sort
 * param in the URL. Rows are sorted on the server, so no client JavaScript is
 * needed. The #anchor brings the reader back to this table after reloading.
 */
export function SortableTable<T>({ rows, columns, sort, param, fallback, current, anchor, rowKey, rowClassName }: {
  rows: readonly T[];
  columns: readonly TableColumn<T>[];
  /** This table's raw sort param from the URL. */
  sort: string | undefined;
  param: string;
  fallback: SortState;
  current: Record<string, string | undefined>;
  anchor: string;
  rowKey: (row: T) => string | number;
  rowClassName?: (row: T) => string | undefined;
}) {
  const { rows: sorted, state } = applySort(rows, columns, sort, fallback);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => {
              if (!column.value) return <th key={column.key}>{column.label}</th>;
              const active = state.key === column.key;
              const next = nextSort(state, column.key, column.defaultDir ?? 'asc');
              const href = `${buildHref(current, { [param]: formatSortParam(next) })}#${anchor}`;
              return (
                <th key={column.key} aria-sort={active ? (state.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <a className="sort" href={href}>
                    {column.label}
                    <span className="arrow" aria-hidden="true">{active ? (state.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                  </a>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className={rowClassName?.(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? 'num' : undefined}>
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
