export default function Loading() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
      <div className="h-40 bg-gray-100 rounded animate-pulse" />
    </div>
  );
}