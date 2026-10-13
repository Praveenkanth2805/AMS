export default function FilterBar({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Filters"
      className={`flex flex-row flex-nowrap items-end gap-2 sm:gap-3
                  rounded-lg border border-gray-200 bg-white p-3
                  overflow-x-auto ${className}`}
    >
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`flex flex-col text-sm shrink-0
                  w-[140px] sm:w-[160px] md:w-[180px] ${className}`}
    >
      <span className="text-gray-600 mb-1 whitespace-nowrap text-xs sm:text-sm">
        {label}
      </span>
      {children}
    </label>
  );
}