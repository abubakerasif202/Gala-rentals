import type { ComponentType } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  actionLabel?: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  onAction?: () => void;
  title: string;
}

export default function EmptyState({
  actionLabel,
  description,
  icon: Icon = Inbox,
  onAction,
  title,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-[#1e3a5f] bg-[#061425]">
        <Icon className="h-6 w-6 text-[#dfb125]" />
      </div>
      <h3 className="text-sm font-bold uppercase tracking-widest text-white">
        {title}
      </h3>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#dfb125] px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#061425] transition-all hover:bg-[#f0c94a]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
