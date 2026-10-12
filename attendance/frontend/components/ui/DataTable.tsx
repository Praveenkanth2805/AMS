import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

export default function DataTable<T>({
  columns, rows, getRowKey, empty,
}: {
  columns: Column<T>[]; rows: T[]; getRowKey: (row: T) => string;
  empty?: React.ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-green-50 text-green-900">
          <tr>
            {columns.map((c) => (
              <th key={c.key}
                  scope="col"
                  className={cn("px-4 py-2 whitespace-nowrap",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    !c.align && "text-left",
                    c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={getRowKey(r)} className="border-t border-gray-100 hover:bg-gray-50">
              {columns.map((c) => (
                <td key={c.key}
                    className={cn("px-4 py-2",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center")}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}