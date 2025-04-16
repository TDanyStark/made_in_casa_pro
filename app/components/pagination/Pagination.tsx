import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, pageCount, onPageChange }: PaginationProps) => {
  return (
    <div className="flex items-center justify-end space-x-2 py-4">
      <div className="text-sm text-muted-foreground">
        Página {currentPage} de {pageCount || 1}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(0)}
        disabled={currentPage <= 1}
      >
        <span className="sr-only">Primera página</span>
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 2)}
        disabled={currentPage <= 1}
      >
        <span className="sr-only">Página anterior</span>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage)}
        disabled={currentPage >= pageCount}
      >
        <span className="sr-only">Página siguiente</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(pageCount - 1)}
        disabled={currentPage >= pageCount}
      >
        <span className="sr-only">Última página</span>
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default Pagination;