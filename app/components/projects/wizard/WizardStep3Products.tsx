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
  const [products, setProducts] = useState<ProductType[]>(state.products);
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

  const addProduct = (opt: ProductOption | null) => {
    if (!opt) return;
    if (products.find((p) => p.id === opt.value)) return;
    setProducts((prev) => [...prev, opt.product]);
    setError("");
  };

  const removeProduct = (id: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const availableOptions = productOptions.filter(
    (o) => !products.find((p) => p.id === o.value)
  );

  const handleNext = () => {
    if (products.length === 0) {
      setError("Agrega al menos un producto al proyecto");
      return;
    }
    onNext({ products });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Agregar productos *</label>
        <Select<ProductOption>
          instanceId="wizard-products-select"
          options={availableOptions}
          value={null}
          onChange={(opt) => addProduct(opt as ProductOption | null)}
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

      {products.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">
            Productos seleccionados ({products.length})
          </p>
          <div className="space-y-2">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.category_name && (
                      <p className="text-xs text-muted-foreground">{p.category_name}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeProduct(p.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed py-8 text-center">
          <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Aún no has agregado productos al proyecto
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
