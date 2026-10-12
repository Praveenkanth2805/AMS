export default function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div role="group" aria-label="Filters"
         className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      {children}
    </div>
  );
}

export function FilterField({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col text-sm min-w-[160px]">
      <span className="text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}