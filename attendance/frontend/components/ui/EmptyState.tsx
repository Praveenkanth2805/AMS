import { Inbox } from "lucide-react";

export default function EmptyState({
  title = "Nothing here yet",
  description, action,
}: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg">
      <Inbox className="mx-auto text-gray-400" size={36} />
      <h3 className="mt-3 font-medium text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}