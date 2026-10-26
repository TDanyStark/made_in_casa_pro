"use client";

import { useState } from "react";
import { INVALID_COP_AMOUNT_MESSAGE, parseCopAmount } from "@/lib/utils/cop-amount";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, List, Pencil, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { get, patch } from "@/lib/services/apiService";
import type { ProjectFinancialsView } from "@/lib/queries/projectFinancials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface Props {
  projectId: number;
  canEditSalePrice: boolean;
}

const ALL_VERSIONS = "all";

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

const costVsSaleConfig = {
  cost: { label: "Costo", color: "var(--chart-1)" },
  rest: { label: "Margen", color: "var(--muted)" },
} satisfies ChartConfig;

/** Slim panel above the project tabs: hours, money invested, sale price and margin. */
export function ProjectFinancialCards({ projectId, canEditSalePrice }: Props) {
  const queryClient = useQueryClient();
  const [adjustmentId, setAdjustmentId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["project-financials", projectId, adjustmentId],
    queryFn: async () => {
      const query = adjustmentId === null ? "" : `?adjustment_id=${adjustmentId}`;
      const res = await get<ProjectFinancialsView>(`projects/${projectId}/financials${query}`);
      if (!res.ok) throw new Error(res.error);
      return res.data as ProjectFinancialsView;
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60,
  });

  if (!data) return null;

  const isFiltered = adjustmentId !== null;

  const startEditing = () => {
    setDraft(data.sale_price != null ? String(Math.round(data.sale_price)) : "");
    setIsEditing(true);
  };

  const saveSalePrice = async () => {
    const salePrice = parseCopAmount(draft);
    if (salePrice === undefined) {
      toast.error(INVALID_COP_AMOUNT_MESSAGE);
      return;
    }
    setIsSaving(true);
    try {
      const res = await patch<ProjectFinancialsView>(`projects/${projectId}/financials`, {
        sale_price: salePrice,
      });
      if (!res.ok) throw new Error(res.error || "Error al guardar el precio de venta");
      // PATCH returns the unfiltered summary; every version view depends on the sale price.
      queryClient.setQueryData(["project-financials", projectId, null], res.data);
      await queryClient.invalidateQueries({ queryKey: ["project-financials", projectId] });
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
  const showMargin = !isFiltered && data.sale_price != null && data.margin !== null;
  const marginPercent =
    showMargin && data.sale_price ? Math.round((data.margin! / data.sale_price) * 100) : null;
  const costShare =
    data.sale_price && data.sale_price > 0 ? Math.min(100, (data.total_cost / data.sale_price) * 100) : 0;
  const isProfitable = (data.margin ?? 0) >= 0;

  return (
    <div
      data-testid="financial-cards"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground"
    >
      {/* ── Horas ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <ChartContainer
          config={hoursChartConfig}
          className="aspect-square h-11"
          aria-label="Horas internas y externas"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
            <Pie data={hoursData} dataKey="value" nameKey="key" innerRadius={13} strokeWidth={2}>
              {hoursData.map((d) => (
                <Cell key={d.key} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="leading-tight">
          <p className="flex items-center gap-1 text-xs">
            <Clock className="size-3" /> Horas
          </p>
          <p className="font-medium tabular-nums text-foreground">{formatHours(data.total_minutes)}</p>
          <p className="text-[11px]">
            {`Int. ${formatHours(data.internal_minutes)} · Ext. ${formatHours(data.external_minutes)}`}
          </p>
        </div>
      </div>

      {/* ── Invertido ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <div className="leading-tight">
          <p className="flex items-center gap-1 text-xs">
            <Wallet className="size-3" /> Invertido
          </p>
          <p className="font-medium tabular-nums text-foreground" data-testid="total-cost">
            {formatMoney(data.total_cost)}
          </p>
          <p className="text-[11px]">
            {`Int. ${formatMoney(data.internal_cost)} · Ext. ${formatMoney(data.external_cost)}`}
          </p>
        </div>
        {data.by_collaborator.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Detalle por colaborador">
                <List />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 text-xs">
              <ul className="space-y-1">
                {data.by_collaborator.map((c) => (
                  <li key={c.user_id} className="flex justify-between gap-2">
                    <span className="truncate">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {`${formatHours(c.minutes)} · ${formatMoney(c.cost)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* ── Venta ─────────────────────────────────────────────── */}
      <div className="leading-tight">
        <p className="flex items-center gap-1 text-xs">
          <span>Venta</span>
          {canEditSalePrice && !isEditing && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5"
              aria-label="Editar precio de venta"
              onClick={startEditing}
            >
              <Pencil />
            </Button>
          )}
        </p>
        {isEditing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              saveSalePrice();
            }}
          >
            <Input
              aria-label="Precio de venta del proyecto"
              inputMode="numeric"
              placeholder="Ej: 2500000"
              className="h-7 w-32 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
            <Button type="submit" size="xs" disabled={isSaving}>
              Guardar
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
          </form>
        ) : (
          <p className="font-medium tabular-nums text-foreground" data-testid="sale-price">
            {data.sale_price != null ? formatMoney(data.sale_price) : "Sin registrar"}
          </p>
        )}
        {isFiltered ? (
          <p className="text-[11px]">Precio de todo el proyecto</p>
        ) : (
          data.sale_price == null && (
            <p className="text-[11px]">
              {canEditSalePrice
                ? "Anota en cuánto se vendió para ver el margen."
                : "El comercial aún no ha registrado el precio de venta."}
            </p>
          )
        )}
      </div>

      {/* ── Margen ────────────────────────────────────────────── */}
      {showMargin && (
        <div data-testid="margin" className="leading-tight">
          <p className="text-xs">Margen</p>
          <p
            className={`flex items-center gap-1 font-medium tabular-nums ${
              isProfitable ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {isProfitable ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {formatMoney(data.margin!)}
            <span className="text-[11px] font-normal text-muted-foreground">{`${marginPercent}%`}</span>
          </p>
          <ChartContainer
            config={costVsSaleConfig}
            className="aspect-auto mt-1 h-1.5 w-28"
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
              />
              <Bar dataKey="rest" stackId="share" fill="var(--color-rest)" />
            </BarChart>
          </ChartContainer>
        </div>
      )}

      {/* ── Versión ───────────────────────────────────────────── */}
      {data.versions.length > 0 && (
        <div className="ml-auto">
          <Select
            value={adjustmentId === null ? ALL_VERSIONS : String(adjustmentId)}
            onValueChange={(value) => setAdjustmentId(value === ALL_VERSIONS ? null : Number(value))}
          >
            <SelectTrigger className="h-7 w-auto text-xs" aria-label="Filtrar por versión">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VERSIONS}>Todas las versiones</SelectItem>
              {data.versions.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {`Versión ${v.version_number}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
