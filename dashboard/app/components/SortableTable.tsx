import type { ReactNode } from 'react';
import { buildHref } from '../../lib/format';
import { pageWindow, paginate } from '../../lib/paginate';
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
/** Opt-in pagination: the page number lives in the URL under `param`. */
export interface TablePagination {
  param: string;
  page: number;
  pageSize: number;
}

/**
 * Rows are sorted first and then paginated, so a column sort orders every
 * row, not just the current page. Changing the sort goes back to page 1.
 */
export function SortableTable<T>({ rows, columns, sort, param, fallback, current, anchor, rowKey, rowClassName, pagination }: {
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
  pagination?: TablePagination;
}) {
  const { rows: sorted, state } = applySort(rows, columns, sort, fallback);
  const paged = pagination ? paginate(sorted, pagination.page, pagination.pageSize) : null;
  const visible = paged ? paged.rows : sorted;
  const pageHref = (page: number) =>
    `${buildHref(current, { [pagination!.param]: page === 1 ? undefined : String(page) })}#${anchor}`;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => {
              if (!column.value) return <th key={column.key}>{column.label}</th>;
              const active = state.key === column.key;
              const next = nextSort(state, column.key, column.defaultDir ?? 'asc');
              const reset = pagination ? { [pagination.param]: undefined } : {};
              const href = `${buildHref(current, { ...reset, [param]: formatSortParam(next) })}#${anchor}`;
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
          {visible.map((row) => (
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
      {paged && paged.pageCount > 1 && (
        <nav className="pager" aria-label="Pages">
          <span className="pager-status num">
            {paged.start}–{paged.end} of {rows.length}
          </span>
          <span className="pager-links">
            {paged.page > 1 ? <a href={pageHref(paged.page - 1)} rel="prev">‹ prev</a> : <span className="muted">‹ prev</span>}
            {pageWindow(paged.page, paged.pageCount).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="muted">…</span>
              ) : (
                <a key={p} href={pageHref(p)} aria-current={p === paged.page ? 'page' : undefined} className="num">
                  {p}
                </a>
              ),
            )}
            {paged.page < paged.pageCount ? <a href={pageHref(paged.page + 1)} rel="next">next ›</a> : <span className="muted">next ›</span>}
          </span>
        </nav>
      )}
    </div>
  );
}
