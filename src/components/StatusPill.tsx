import type { BookDisplayStatus } from '../types';

const labels: Record<BookDisplayStatus, string> = {
  available: 'Available',
  queued: 'Requested',
  reserved: 'Handover',
  borrowed: 'Borrowed',
  paused: 'Not lending',
};

export function StatusPill({ status }: { status: BookDisplayStatus }) {
  return <span className={`status-pill status-${status}`}>{labels[status]}</span>;
}
