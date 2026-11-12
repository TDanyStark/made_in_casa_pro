"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Clock, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { useProjectFinancials } from "@/hooks/useProjectFinancials";
import { formatMoney } from "@/lib/utils/format-money";
import { formatHours } from "@/lib/utils/time";
import { cn } from "@/lib/utils";
import type { ProjectVersion } from "@/lib/queries/projectFinancials";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const ALL_VERSIONS = "all";

const hoursChartConfig = {
  internal: { label: "Internas", color: "var(--chart-1)" },
  external: { label: "Externas", color: "var(--chart-2)" },
} satisfies ChartConfig;

const costVsSaleConfig = {
  cost: { label: "Costo", color: "var(--chart-1)" },
  rest: { label: "Margen", color: "var(--muted)" },
} satisfies ChartConfig;

/** Rounded share of `part` in `total` (0 when there is no total). */
export const percentOf = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/** Version filter shared by the summary and the Métricas tab (null = all versions). */
export function ProjectVersionSelect({
  versions,
  value,
  onChange,
}: {
  versions: ProjectVersion[];
  value: number | null;
  onChange: (adjustmentId: number | null) => void;
}) {
  if (versions.length === 0) return null;
  return (
    <Select
      value={value === null ? ALL_VERSIONS : String(value)}
      onValueChange={(v) => onChange(v === ALL_VERSIONS ? null : Number(v))}
    >
      <SelectTrigger className="h-8 w-auto text-xs" aria-label="Filtrar por versión">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VERSIONS}>Todas las versiones</SelectItem>
        {versions.map((v) => (
          <SelectItem key={v.id} value={String(v.id)}>
            {`Versión ${v.version_number}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Internal vs external hours donut. */
export function HoursDonut({
  internalMinutes,
  externalMinutes,
  className,
  innerRadius,
}: {
  internalMinutes: number;
  externalMinutes: number;
  className?: string;
  innerRadius: number;
}) {
  const data = [
    { key: "internal", value: internalMinutes / 60, fill: "var(--color-internal)" },
    { key: "external", value: externalMinutes / 60, fill: "var(--color-external)" },
  ];
  return (
    <ChartContainer
      config={hoursChartConfig}
      className={cn("aspect-square", className)}
      aria-label="Horas internas y externas"
    >
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
        <Pie data={data} dataKey="value" nameKey="key" innerRadius={innerRadius} strokeWidth={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

/** Horizontal bar: how much of the sale price the cost has eaten. */
export function CostVsSaleBar({
  cost,
  salePrice,
  className,
}: {
  cost: number;
  salePrice: number;
  className?: string;
}) {
  const costShare = salePrice > 0 ? Math.min(100, (cost / salePrice) * 100) : 100;
  const isProfitable = cost <= salePrice;
  return (
    <ChartContainer
      config={costVsSaleConfig}
      className={cn("aspect-auto w-full", className)}
      aria-label="Costo frente al precio de venta"
    >
      <BarChart
        data={[{ cost: costShare, rest: 100 - costShare }]}
        layout="vertical"
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide domain={[0, 100]} />
        <YAxis type="category" hide />
        <Bar
          dataKey="cost"
          stackId="share"
          fill={isProfitable ? "var(--color-cost)" : "var(--destructive)"}
          radius={[4, 0, 0, 4]}
        />
        <Bar dataKey="rest" stackId="share" fill="var(--color-rest)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function Tile({
  icon,
  label,
  className,
  testId,
  children,
}: {
  icon: ReactNode;
  label: string;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div data-testid={testId} className={cn("rounded-xl border bg-card p-4", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Summary above the project tabs: hours, money invested and margin. */
export function ProjectFinancialCards({ projectId }: { projectId: number }) {
  const [adjustmentId, setAdjustmentId] = useState<number | null>(null);
  const { data } = useProjectFinancials(projectId, adjustmentId);

  if (!data) return null;

  const isFiltered = adjustmentId !== null;
  const hasSalePrice = data.sale_price != null;
  const margin = data.margin ?? 0;
  const isProfitable = margin >= 0;

  return (
    <section data-testid="financial-cards" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Resumen</h2>
        <ProjectVersionSelect versions={data.versions} value={adjustmentId} onChange={setAdjustmentId} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile icon={<Clock className="size-3.5" />} label="Horas">
          <div className="flex items-center gap-3">
            <HoursDonut
              internalMinutes={data.internal_minutes}
              externalMinutes={data.external_minutes}
              className="h-12"
              innerRadius={14}
            />
            <div className="leading-tight">
              <p className="text-xl font-semibold tabular-nums">{formatHours(data.total_minutes)}</p>
              <p className="text-xs text-muted-foreground">
                {`Int. ${formatHours(data.internal_minutes)} · Ext. ${formatHours(data.external_minutes)}`}
              </p>
            </div>
          </div>
        </Tile>

        <Tile icon={<Wallet className="size-3.5" />} label="Invertido">
          <p className="text-xl font-semibold tabular-nums" data-testid="total-cost">
            {formatMoney(data.total_cost)}
          </p>
          <p className="text-xs text-muted-foreground">
            {`Int. ${formatMoney(data.internal_cost)} · Ext. ${formatMoney(data.external_cost)}`}
          </p>
        </Tile>

        <Tile
          testId="margin"
          label="Margen"
          icon={
            !hasSalePrice ? (
              <AlertCircle className="size-3.5" />
            ) : isProfitable ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )
          }
          className={cn(!hasSalePrice && "border-destructive bg-destructive/5")}
        >
          {!hasSalePrice ? (
            <p className="text-sm font-medium text-destructive">Sin precio de venta</p>
          ) : isFiltered || data.margin === null ? (
            <p className="text-sm text-muted-foreground">Margen solo para todo el proyecto</p>
          ) : (
            <>
              <p
                className={cn(
                  "flex items-baseline gap-2 text-xl font-semibold tabular-nums",
                  isProfitable ? "text-emerald-600" : "text-destructive"
                )}
              >
                {formatMoney(margin)}
                <span className="text-xs font-normal text-muted-foreground">
                  {`${percentOf(margin, data.sale_price!)}%`}
                </span>
              </p>
              <CostVsSaleBar cost={data.total_cost} salePrice={data.sale_price!} className="mt-2 h-2" />
            </>
          )}
        </Tile>
      </div>
    </section>
  );
}
