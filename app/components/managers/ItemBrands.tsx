"use client";

import { Badge } from "@/components/ui/badge";
import { BrandType } from "@/lib/definitions";
import Link from "next/link";
interface ItemBrandsProps {
  brands: BrandType[];
}

const ItemBrands = ({ brands = [] }: ItemBrandsProps) => {
  return (
    <div className="flex justify-between group bg-gray-100/80 dark:bg-gray-800/50 p-3 rounded-lg gap-6">
      <div>
        <h3>Marcas</h3>
        <div className="flex gap-2 mt-2 flex-wrap">
          {brands.length > 0 ? (
            brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brands/${brand.id}`}
              >
                <Badge
                  key={brand.id}
                  className="bg-market-green/20 text-gray-900 dark:text-white hover:bg-market-green/30 border-market-green/30"
                >
                  {brand.name}
                </Badge>
              </Link>
            ))
          ) : (
            <span className="text-sm text-gray-500">
              No hay marcas asignadas
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemBrands;
