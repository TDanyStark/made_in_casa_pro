import React, { useRef, useEffect, useState } from "react";

interface AutoResizeInputProps {
  value: string;
  height?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

const AutoResizeInput =({
  value,
  height = 24,
  onChange,
  onKeyDown,
  autoFocus,
  disabled,
  className = "",
}: AutoResizeInputProps) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialWidth, setInitialWidth] = useState(0);
  
  useEffect(() => {
    if (spanRef.current) {
      const spanWidth = spanRef.current.offsetWidth;
      setInitialWidth(spanWidth); // establece el ancho inicial en 500px como mínimo
    }
  }, []);

  useEffect(() => {
    if (spanRef.current &&  containerRef.current) {
      const spanWidth = spanRef.current.offsetWidth;
      // si el spanWidth es menor al initialWidth, no se debe cambiar el ancho del input
      if (spanWidth < initialWidth) {
        containerRef.current.style.width = `${initialWidth}px`;
      } else {
        containerRef.current.style.width = `${Math.min(spanWidth, 450)}px`;
      }
    }
  }, [initialWidth, value]);

  return (
    <div ref={containerRef} 
      className="relative border-b border-gray-400"
      style={{ height: `${height}px` }}
    >
      {/* Input real */}
      <input
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        className={`w-full p-0 border-0 focus:border-gray-600 focus:ring-0 outline-none text-gray-900 dark:text-white bg-transparent absolute top-0 left-0 ${className}`}
      />

      {/* Span oculto para medir el texto */}
      <span
        ref={spanRef}
        className="invisible whitespace-pre"
      >
        {value || " "}
      </span>
    </div>
  );
}

export default AutoResizeInput;