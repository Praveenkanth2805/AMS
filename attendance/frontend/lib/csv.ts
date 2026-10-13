/**
 * Client-side CSV download helper.
 * Builds a Blob and triggers a browser download.
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  exampleRows: string[][] = [],
): void {
  const escape = (v: string) => {
    const s = String(v ?? "");
    // Quote if it contains comma, quote, or newline
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines: string[] = [];
  lines.push(headers.map(escape).join(","));
  for (const row of exampleRows) {
    lines.push(row.map(escape).join(","));
  }

  // Prepend UTF-8 BOM so Excel opens it with correct encoding
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}