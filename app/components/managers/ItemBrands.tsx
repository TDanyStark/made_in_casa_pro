import { Badge } from "@/components/ui/badge"

const ItemBrands = () => {
  return (
    <div className="flex justify-between group bg-gray-100/80 dark:bg-gray-800/50 p-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors gap-6">
      <div>
        <h3 className="text-sm text-gray-500 dark:text-gray-400">Marcas</h3>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge className="bg-market-pink/20 text-gray-900 dark:text-white hover:bg-market-pink/30 border-market-pink/30">
            Abbott
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default ItemBrands;
