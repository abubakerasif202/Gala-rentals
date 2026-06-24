import type { ComponentType, ReactNode } from 'react';

export type DetailCardItem = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
};

interface DetailCardProps {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  items?: DetailCardItem[];
  status?: ReactNode;
  title: string;
}

export default function DetailCard({
  actions,
  children,
  description,
  footer,
  icon: Icon,
  items = [],
  status,
  title,
}: DetailCardProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] text-white shadow-[0_20px_70px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-5 border-b border-white/10 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          {Icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-white">
                {title}
              </h3>
              {status && <div className="shrink-0">{status}</div>}
            </div>
            {description && (
              <div className="mt-2 max-w-2xl text-sm leading-6 text-brand-grey">
                {description}
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>

      {items.length > 0 && (
        <dl className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.label} className="bg-[#0b1f36] px-5 py-4 sm:px-6">
              <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {item.label}
              </dt>
              <dd className="mt-2 break-words text-sm font-semibold text-white">
                {item.value}
              </dd>
              {item.helper && (
                <dd className="mt-2 text-xs leading-5 text-slate-400">
                  {item.helper}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}

      {children && <div className="px-5 py-5 sm:px-6">{children}</div>}

      {footer && (
        <div className="border-t border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-brand-grey sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}
