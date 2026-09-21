"use client";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function DownloadCsvButton({
  comics,
  showLabels,
  cells,
}: {
  comics: { id: number; name: string; email: string }[];
  showLabels: string[];
  cells: string[][];
}) {
  function download() {
    const header = ["Name", "Email", ...showLabels].map(csvEscape).join(",");
    const rows = comics.map((comic, i) =>
      [comic.name, comic.email, ...cells[i]].map(csvEscape).join(",")
    );
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "avails.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={comics.length === 0}
      className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-950 disabled:opacity-50"
    >
      Download CSV
    </button>
  );
}
