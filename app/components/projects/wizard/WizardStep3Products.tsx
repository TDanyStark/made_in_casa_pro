"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import Select from "react-select";
import { get } from "@/lib/services/apiService";
import { ProductType, ApiResponseWithPagination } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { X, Package } from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";

interface ProductOption {
  value: number;
  label: string;
  categoryName: string | null;
  product: ProductType;
}

interface Props {
  state: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export function WizardStep3Products({ state, onNext, onBack }: Props) {
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<ProductType | null>(state.product);
  const [error, setError] = useState("");

  const { data: productOptions = [], isLoading } = useQuery({
    queryKey: ["products-search", search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "30", is_active: "1" });
      if (search) params.set("search", search);
      const res = await get<ApiResponseWithPagination<ProductType[]>>(`products?${params}`);
      if (!res.ok || !res.data) return [];
      return ((res.data as unknown as { data: ProductType[] }).data ?? []).map(
        (p): ProductOption => ({
          value: p.id,
          label: p.name,
          categoryName: p.category_name,
          product: p,
        })
      );
    },
    staleTime: 1000 * 60,
  });

  const debouncedSearch = debounce((v: string) => setSearch(v), 400);

  const selectProduct = (opt: ProductOption | null) => {
    if (!opt) return;
    setProduct(opt.product);
    setError("");
  };

  const clearProduct = () => setProduct(null);

  const handleNext = () => {
    if (!product) {
      setError("Selecciona un producto para el proyecto");
      return;
    }
    onNext({ product });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Producto del proyecto *</label>
        <Select<ProductOption>
          instanceId="wizard-products-select"
          options={productOptions}
          value={null}
          onChange={(opt) => selectProduct(opt as ProductOption | null)}
          onInputChange={(v) => debouncedSearch(v)}
          isLoading={isLoading}
          placeholder="Buscar producto..."
          noOptionsMessage={({ inputValue }) =>
            inputValue ? "Sin resultados" : "Escribe para buscar"
          }
          controlShouldRenderValue={false}
          formatOptionLabel={(opt: ProductOption) => (
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              {opt.categoryName && (
                <p className="text-xs text-muted-foreground">{opt.categoryName}</p>
              )}
            </div>
          )}
          classNamePrefix="react-select"
          filterOption={() => true}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {product ? (
        <div className="rounded-md border bg-card px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">{product.name}</p>
              {product.category_name && (
                <p className="text-xs text-muted-foreground">{product.category_name}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={clearProduct}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-dashed py-8 text-center">
          <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Aún no has seleccionado un producto
          </p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button type="button" onClick={handleNext}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
