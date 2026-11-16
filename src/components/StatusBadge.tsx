import { CheckCircle2, Clock, Wrench, XCircle } from 'lucide-react';
import type { StatusType } from '../shared/constants';

interface StatusIndicatorProps {
  status: StatusType;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  if (status === 'Selesai') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Selesai</span>
      </span>
    );
  }

  if (status === 'Diproses') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Diproses</span>
      </span>
    );
  }

  if (status === 'Ditolak') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Ditolak</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Menunggu</span>
    </span>
  );
}
