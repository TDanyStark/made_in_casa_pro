import { useEffect, useCallback } from 'react';

type KeyCombination = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
};

type KeyboardShortcutOptions = {
  enabled?: boolean;
};

/**
 * Hook personalizado para manejar atajos de teclado
 * @param keyCombination La combinación de teclas que activará la acción
 * @param callback La función a ejecutar cuando se detecta la combinación de teclas
 * @param options Opciones adicionales para el hook
 */
export const useKeyboardShortcut = (
  keyCombination: KeyCombination,
  callback: () => void,
  options: KeyboardShortcutOptions = {}
) => {
  const { enabled = true } = options;
  
  // No procesar si la tecla está vacía
  const isValidKeyCombination = keyCombination.key.trim() !== '';
    const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      
      // No continuar si la combinación de teclas no es válida
      if (!isValidKeyCombination) return;
      console.log(`Key pressed: ${event.key}`);
      
      const keyMatches = event.key.toLowerCase() === keyCombination.key.toLowerCase();
      const altMatches = keyCombination.altKey === undefined || event.altKey === keyCombination.altKey;
      const ctrlMatches = keyCombination.ctrlKey === undefined || event.ctrlKey === keyCombination.ctrlKey;
      const shiftMatches = keyCombination.shiftKey === undefined || event.shiftKey === keyCombination.shiftKey;
      
      if (enabled && keyMatches && altMatches && ctrlMatches && shiftMatches) {
        event.preventDefault();
        callback();
      }
    },
    [keyCombination, callback, enabled, isValidKeyCombination]
  );
  
  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
    // Retorna un formato legible para mostrar la combinación de teclas
  const getDisplayText = (): string => {
    // Si no es una combinación válida, no mostrar nada
    if (!isValidKeyCombination) return '';
    
    const parts: string[] = [];
    
    if (keyCombination.ctrlKey) parts.push('Ctrl');
    if (keyCombination.altKey) parts.push('Alt');
    if (keyCombination.shiftKey) parts.push('Shift');
    
    // Solo añadir la tecla si no está vacía
    if (keyCombination.key.trim() !== '') {
      parts.push(keyCombination.key.toUpperCase());
    }
    
    return parts.length > 0 ? parts.join(' + ') : '';
  };
  
  return {
    shortcutDisplay: getDisplayText()
  };
};
