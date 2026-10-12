import { cn } from "@/lib/utils";

export default function FormField({
  label, htmlFor, error, required, hint, children, className,
}: {
  label: string; htmlFor: string; error?: string; required?: boolean;
  hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-800">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}