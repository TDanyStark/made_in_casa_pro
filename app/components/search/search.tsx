"use client";

import { useState, FormEvent, ChangeEvent, KeyboardEvent } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  initialSearchValue?: string;
  placeholder?: string;
  onSearch: (searchValue: string) => void;
  onReset: () => void;
}

const SearchBar = ({
  initialSearchValue = "",
  placeholder = "Buscar...",
  onSearch,
  onReset,
}: SearchBarProps) => {
  const [searchInputValue, setSearchInputValue] = useState(initialSearchValue);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    onSearch(searchInputValue);
  };

  const handleSearchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      onSearch(searchInputValue);
    }
  };

  const handleReset = () => {
    setSearchInputValue("");
    onReset();
  };

  return (
    <form onSubmit={handleSearch} className="flex items-center space-x-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={placeholder}
          className="pl-8"
          value={searchInputValue}
          onChange={handleSearchInputChange}
          onKeyDown={handleKeyDown}
        />
      </div>
      <Button type="submit" variant="secondary">
        Buscar
      </Button>
      <Button type="button" variant="outline" onClick={handleReset}>
        <RefreshCw className="h-4 w-4" />
      </Button>
    </form>
  );
};

export default SearchBar;