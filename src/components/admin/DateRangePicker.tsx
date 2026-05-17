export type DateRangePreset = 'custom' | 'last7' | 'mtd' | 'today';

export interface DateRangeValue {
  endDate: string;
  preset: DateRangePreset;
  startDate: string;
}

interface DateRangePickerProps {
  onChange: (value: DateRangeValue) => void;
  value: DateRangeValue;
}

const padDatePart = (value: number) => String(value).padStart(2, '0');

const formatDateOnly = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

export const getDateRangeForPreset = (
  preset: Exclude<DateRangePreset, 'custom'>,
  now = new Date()
): DateRangeValue => {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);

  if (preset === 'last7') {
    start.setDate(end.getDate() - 6);
  }

  if (preset === 'mtd') {
    start.setDate(1);
  }

  return {
    endDate: formatDateOnly(end),
    preset,
    startDate: formatDateOnly(start),
  };
};

export default function DateRangePicker({ onChange, value }: DateRangePickerProps) {
  return (
    <div className="grid w-full gap-3 rounded-lg border border-[#1e3a5f] bg-[#061425] p-3 sm:w-auto sm:grid-cols-[auto_1fr] sm:items-center">
      <select
        value={value.preset}
        onChange={(event) => {
          const preset = event.target.value as DateRangePreset;

          if (preset === 'custom') {
            onChange({ ...value, preset });
            return;
          }

          onChange(getDateRangeForPreset(preset));
        }}
        className="min-h-11 w-full rounded-lg border border-[#1e3a5f] bg-[#0b1f36] px-3 text-xs font-bold uppercase tracking-widest text-white outline-none focus:border-[#dfb125]"
      >
        <option value="today">Today</option>
        <option value="last7">Last 7 Days</option>
        <option value="mtd">MTD</option>
        <option value="custom">Custom</option>
      </select>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <input
          type="date"
          value={value.startDate}
          disabled={value.preset !== 'custom'}
          onChange={(event) =>
            onChange({ ...value, preset: 'custom', startDate: event.target.value })
          }
          className="min-h-11 w-full rounded-lg border border-[#1e3a5f] bg-[#0b1f36] px-3 text-xs text-white outline-none focus:border-[#dfb125] disabled:opacity-60"
        />
        <span className="text-xs uppercase tracking-widest text-slate-400">to</span>
        <input
          type="date"
          value={value.endDate}
          disabled={value.preset !== 'custom'}
          onChange={(event) =>
            onChange({ ...value, preset: 'custom', endDate: event.target.value })
          }
          className="min-h-11 w-full rounded-lg border border-[#1e3a5f] bg-[#0b1f36] px-3 text-xs text-white outline-none focus:border-[#dfb125] disabled:opacity-60"
        />
      </div>
    </div>
  );
}
