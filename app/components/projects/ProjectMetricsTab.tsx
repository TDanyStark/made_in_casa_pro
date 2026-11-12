"use client";

import { useState } from "react";
import { useProjectFinancials } from "@/hooks/useProjectFinancials";
import { formatMoney } from "@/lib/utils/format-money";
import { formatHours } from "@/lib/utils/time";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CostVsSaleBar,
  HoursDonut,
  ProjectVersionSelect,
  percentOf,
} from "./ProjectFinancialCards";

/** Métricas tab (dirección): hours by type, cost vs sale and investment per collaborator. */
export function ProjectMetricsTab({ projectId }: { projectId: number }) {
  const [adjustmentId, setAdjustmentId] = useState<number | null>(null);
  const { data, isLoading, isError } = useProjectFinancials(projectId, adjustmentId);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) {
    return <p className="py-8 text-center text-destructive">Error al cargar las métricas del proyecto</p>;
  }

  const isFiltered = adjustmentId !== null;
  const collaborators = [...data.by_collaborator].sort((a, b) => b.cost - a.cost);
  const margin = data.margin;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ProjectVersionSelect versions={data.versions} value={adjustmentId} onChange={setAdjustmentId} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas por tipo</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <HoursDonut
              internalMinutes={data.internal_minutes}
              externalMinutes={data.external_minutes}
              className="h-32"
              innerRadius={36}
            />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatHours(data.total_minutes)}</dd>
              </div>
              <HoursRow
                testId="hours-internal"
                label="Internas"
                color="var(--chart-1)"
                minutes={data.internal_minutes}
                total={data.total_minutes}
              />
              <HoursRow
                testId="hours-external"
                label="Externas"
                color="var(--chart-2)"
                minutes={data.external_minutes}
                total={data.total_minutes}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costo frente a venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Costo total</dt>
                <dd className="font-semibold tabular-nums" data-testid="metrics-total-cost">
                  {formatMoney(data.total_cost)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Precio de venta</dt>
                <dd
                  data-testid="metrics-sale-price"
                  className={cn("font-semibold tabular-nums", data.sale_price == null && "text-destructive")}
                >
                  {data.sale_price != null ? formatMoney(data.sale_price) : "Sin registrar"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Margen</dt>
                <dd data-testid="metrics-margin">
                  {isFiltered ? (
                    <span className="text-xs text-muted-foreground">Margen solo para todo el proyecto</span>
                  ) : margin === null || data.sale_price == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        margin >= 0 ? "text-emerald-600" : "text-destructive"
                      )}
                    >
                      {`${formatMoney(margin)} · ${percentOf(margin, data.sale_price)}%`}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {data.sale_price != null && (
              <CostVsSaleBar cost={data.total_cost} salePrice={data.sale_price} className="h-3" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inversión por colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          {collaborators.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay horas registradas en este proyecto.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">% del costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaborators.map((c) => (
                  <TableRow key={c.user_id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_internal ? "secondary" : "outline"}>
                        {c.is_internal ? "Interno" : "Externo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(c.minutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(c.cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {`${percentOf(c.cost, data.total_cost)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatHours(data.total_minutes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(data.total_cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {data.total_cost > 0 ? "100%" : "0%"}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HoursRow({
  testId,
  label,
  color,
  minutes,
  total,
}: {
  testId: string;
  label: string;
  color: string;
  minutes: number;
  total: number;
}) {
  return (
    <div data-testid={testId}>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        {label}
      </dt>
      <dd className="tabular-nums">{`${formatHours(minutes)} · ${percentOf(minutes, total)}%`}</dd>
    </div>
  );
}
