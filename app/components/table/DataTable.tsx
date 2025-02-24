import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: unknown, row: T) => JSX.Element | string;
}

interface ActionComponentProps<T> {
  row: T;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  actions?: React.ComponentType<ActionComponentProps<T>>[];
}

export default function DataTable<T>({ data, columns, actions }: DataTableProps<T>) {
  return (
    <div className="mt-6">
      {/* Mobile View */}
      <div className="md:hidden">
        {data.map((row, rowIndex) => (
          <div key={rowIndex} className="mb-2 w-full rounded-md bg-white p-4 shadow-md">
            <div className="border-b pb-4">
              {columns.map((col) => (
                <p key={String(col.key)} className="text-sm text-gray-700">
                  <strong>{col.label}:</strong> {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                </p>
              ))}
            </div>
            {actions && (
              <div className="flex justify-end gap-2 pt-4">
                {actions.map((ActionComponent, index) => (
                  <ActionComponent key={index} row={row} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Desktop View */}
      <div className="hidden md:block">
        <Table>
          <TableCaption>Lista de registros</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={String(col.key)}>{col.label}</TableHead>
              ))}
              {actions && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((col) => (
                  <TableCell key={String(col.key)}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {actions.map((ActionComponent, index) => (
                        <ActionComponent key={index} row={row} />
                      ))}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}