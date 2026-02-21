import * as XLSX from 'xlsx';

interface Column {
    key: string;
    header: string;
}

export function exportToExcel(data: Record<string, unknown>[], filename: string, columns: Column[]) {
    const rows = data.map(row =>
        columns.reduce((acc, col) => {
            acc[col.header] = row[col.key] ?? '';
            return acc;
        }, {} as Record<string, unknown>)
    );

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, `${filename}.xlsx`);
}
