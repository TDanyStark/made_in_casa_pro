"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Pencil, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Cell, Label, Pie, PieChart, Bar, BarChart, XAxis, YAxis } from "recharts";
import { get, patch } from "@/lib/services/apiService";
import type { ProjectFinancials } from "@/lib/project-financials";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface Props {
  projectId: number;
  canEditSalePrice: boolean;
}

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const formatMoney = (value: number) => money.format(value);

/** Worked time as hours, never days ("3 h 30 min"). */
export function formatHours(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (minutes === 0) return `${hours} h`;
  return hours === 0 ? `${minutes} min` : `${hours} h ${minutes} min`;
}

const hoursChartConfig = {
  internal: { label: "Internos", color: "var(--chart-1)" },
  external: { label: "Externos", color: "var(--chart-2)" },
} satisfies ChartConfig;

const costChartConfig = {
  cost: { label: "Costo", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ProjectFinancialCards({ projectId, canEditSalePrice }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ["project-financials", projectId];
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await get<ProjectFinancials>(`projects/${projectId}/financials`);
      if (!res.ok) throw new Error(res.error);
      return res.data as ProjectFinancials;
    },
    staleTime: 1000 * 60,
  });

  if (!data) return null;

  const startEditing = () => {
    setDraft(data.sale_price != null ? String(data.sale_price) : "");
    setIsEditing(true);
  };

  const saveSalePrice = async () => {
    const clean = draft.replace(/[^0-9.]/g, "");
    const salePrice = clean === "" ? null : Number(clean);
    setIsSaving(true);
    try {
      const res = await patch<ProjectFinancials>(`projects/${projectId}/financials`, {
        sale_price: salePrice,
      });
      if (!res.ok) throw new Error(res.error || "Error al guardar el precio de venta");
      queryClient.setQueryData(queryKey, res.data);
      toast.success("Precio de venta actualizado");
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar el precio de venta");
    } finally {
      setIsSaving(false);
    }
  };

  const hoursData = [
    { key: "internal", value: data.internal_minutes / 60, fill: "var(--color-internal)" },
    { key: "external", value: data.external_minutes / 60, fill: "var(--color-external)" },
  ];
  const costData = data.by_collaborator.slice(0, 5).map((c) => ({ name: c.name, cost: c.cost }));
  const marginPercent =
    data.sale_price && data.margin !== null ? Math.round((data.margin / data.sale_price) * 100) : null;
  const costShare =
    data.sale_price && data.sale_price > 0 ? Math.min(100, (data.total_cost / data.sale_price) * 100) : 0;
  const isProfitable = (data.margin ?? 0) >= 0;

  return (
    <div data-testid="financial-cards" className="grid gap-4 md:grid-cols-3">
      {/* ── Horas ─────────────────────────────────────────────── */}
      <Card className="gap-2">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Clock className="size-4" /> Horas del equipo
          </CardDescription>
          <CardTitle className="text-3xl tabular-nums">{formatHours(data.total_minutes)}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <ChartContainer
            config={hoursChartConfig}
            className="aspect-square h-28"
            aria-label="Horas internas y externas"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
              <Pie data={hoursData} dataKey="value" nameKey="key" innerRadius={32} strokeWidth={4}>
                {hoursData.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[var(--chart-1)]" />
              {`Internos: ${formatHours(data.internal_minutes)}`}
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[var(--chart-2)]" />
              {`Externos: ${formatHours(data.external_minutes)}`}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* ── Dinero ────────────────────────────────────────────── */}
      <Card className="gap-2">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Wallet className="size-4" /> Dinero invertido
          </CardDescription>
          <CardTitle className="text-3xl tabular-nums" data-testid="total-cost">
            {formatMoney(data.total_cost)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {`Internos ${formatMoney(data.internal_cost)} · Externos ${formatMoney(data.external_cost)}`}
          </p>
        </CardHeader>
        <CardContent>
          {costData.length > 0 ? (
            <ChartContainer
              config={costChartConfig}
              className="h-28 w-full"
              aria-label="Costo por colaborador"
            >
              <BarChart data={costData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel={false}
                      formatter={(value) => formatMoney(Number(value))}
                    />
                  }
                />
                <Bar dataKey="cost" fill="var(--color-cost)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay tiempo registrado.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Venta ─────────────────────────────────────────────── */}
      <Card className="gap-2">
        <CardHeader>
          <CardDescription className="flex items-center justify-between gap-2">
            <span>Precio de venta</span>
            {canEditSalePrice && !isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Editar precio de venta"
                onClick={startEditing}
              >
                <Pencil className="size-4" />
              </Button>
            )}
          </CardDescription>
          {isEditing ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveSalePrice();
              }}
            >
              <Input
                aria-label="Precio de venta del proyecto"
                inputMode="numeric"
                placeholder="Ej: 2500000"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={isSaving}
                autoFocus
              />
              <Button type="submit" size="sm" disabled={isSaving}>
                Guardar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
            </form>
          ) : (
            <CardTitle className="text-3xl tabular-nums" data-testid="sale-price">
              {data.sale_price != null ? formatMoney(data.sale_price) : "Sin registrar"}
            </CardTitle>
          )}
        </CardHeader>
        <CardContent>
          {data.sale_price != null && data.margin !== null ? (
            <div className="flex items-center gap-4">
              <ChartContainer
                config={hoursChartConfig}
                className="aspect-square h-28"
                aria-label="Costo frente al precio de venta"
              >
                <PieChart>
                  <Pie
                    data={[
                      { key: "cost", value: costShare },
                      { key: "rest", value: 100 - costShare },
                    ]}
                    dataKey="value"
                    innerRadius={32}
                    startAngle={90}
                    endAngle={-270}
                    strokeWidth={4}
                  >
                    <Cell fill={isProfitable ? "var(--chart-2)" : "var(--destructive)"} />
                    <Cell fill="var(--muted)" />
                    <Label
                      position="center"
                      className="fill-foreground text-sm font-semibold"
                      value={`${Math.round(costShare)}%`}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div data-testid="margin" className="space-y-1 text-sm">
                <p className="text-muted-foreground">Margen</p>
                <p
                  className={`flex items-center gap-1 text-lg font-semibold tabular-nums ${
                    isProfitable ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {isProfitable ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  {formatMoney(data.margin)}
                </p>
                <p className="text-xs text-muted-foreground">{`${marginPercent}% del precio de venta`}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {canEditSalePrice
                ? "Anota en cuánto se vendió para ver el margen."
                : "El comercial aún no ha registrado el precio de venta."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
