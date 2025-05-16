import React, { forwardRef } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { VariantProps } from 'class-variance-authority';

type KeyboardShortcutProps = {
  shortcutKey: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  tooltipText?: string;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
};

export interface ButtonWithShortcutProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  shortcut?: KeyboardShortcutProps;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

const ButtonWithShortcut = forwardRef<HTMLButtonElement, ButtonWithShortcutProps>(
  ({ shortcut, onClick, children, ...props }, ref) => {
    let tooltipContent = shortcut?.tooltipText || '';
    
    
    // Si hay un atajo de teclado definido, configurar el hook
    // Siempre llamamos al hook, pero con opciones condicionales
    const { shortcutDisplay } = useKeyboardShortcut(
      shortcut 
        ? { 
            key: shortcut.shortcutKey, 
            altKey: shortcut.altKey, 
            ctrlKey: shortcut.ctrlKey, 
            shiftKey: shortcut.shiftKey
          }
        : { key: '' }, // Clave vacía que nunca coincidirá
      () => {
          // Llamar directamente a la función onClick para que funcione igual que un clic
          onClick({} as React.MouseEvent<HTMLButtonElement>);
      },
      { enabled: !!shortcut } // Habilitamos el hook solo si hay un shortcut definido
    );
    
    // Si hay una combinación de teclas, incluirla en el tooltip
    if (shortcutDisplay) {
      tooltipContent = tooltipContent 
        ? `${tooltipContent} (${shortcutDisplay})`
        : `Atajo: ${shortcutDisplay}`;
    }
    
    // Si no hay tooltip para mostrar, renderizar solo el botón
    if (!tooltipContent) {
      return (
        <Button ref={ref} onClick={onClick} {...props}>
          {children}
        </Button>
      );
    }
    
    // Renderizar botón con tooltip
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button ref={ref} onClick={onClick} {...props}>
              {children}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={shortcut?.tooltipSide || 'top'}>
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

ButtonWithShortcut.displayName = 'ButtonWithShortcut';

export { ButtonWithShortcut };
