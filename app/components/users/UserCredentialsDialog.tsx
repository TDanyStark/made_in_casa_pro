"use client";


import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface UserCredentialsDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userData: {
    email: string;
    password: string;
  } | null;
  title: string;
  onClose?: () => void;
}

const UserCredentialsDialog = ({
  isOpen,
  setIsOpen,
  userData,
  title,
  onClose,
}: UserCredentialsDialogProps) => {
  // Función para copiar credenciales al portapapeles
  const copyCredentials = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (userData) {
      const textToCopy = `Email: ${userData.email}\nContraseña: ${userData.password}`;
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          toast.success("Credenciales copiadas al portapapeles");
        })
        .catch((err) => {
          console.error("Error al copiar credenciales:", err);
          toast.error("Error al copiar credenciales");
        });
    }
  };

  // Maneja el cierre de la alerta
  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Guarda estas credenciales:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-md mt-2 space-y-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Email:</span>
            <span className="text-base">{userData?.email}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Contraseña:</span>
            <span className="text-base">{userData?.password}</span>
          </div>
        </div>

        <AlertDialogFooter className="mt-4">
          {/* Usar div en lugar de AlertDialogAction para evitar el cierre automático */}
          <div>
            <Button
              className="flex gap-2 items-center"
              onClick={copyCredentials}
            >
              <Copy size={16} />
              Copiar credenciales
            </Button>
          </div>
          <AlertDialogAction asChild>
            <Button onClick={handleClose}>Cerrar</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UserCredentialsDialog;
