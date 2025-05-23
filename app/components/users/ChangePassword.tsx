"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { patch } from "@/lib/services/apiService";
import { Loader2 } from "lucide-react";
import { UserType } from "@/lib/definitions";
import UserCredentialsDialog from "./UserCredentialsDialog";

// Esquema de validación para la contraseña
const passwordSchema = z.object({
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .max(50, "La contraseña no puede tener más de 50 caracteres"),
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

interface ChangePasswordProps {
  userId: string | number;
}

const ChangePassword = ({ userId }: ChangePasswordProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [userData, setUserData] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Configuración del formulario
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
    },
  });
  // Maneja el cierre de la alerta
  const handleAlertClose = () => {
    setShowAlert(false);
  };

  // Maneja el envío del formulario
  const onSubmit = async (data: PasswordFormValues) => {
    setIsLoading(true);
    try {
      // Obtener el email del usuario para mostrarlo en la alerta de éxito
      const response = await patch<UserType>(`users/${userId}`, {
        password: data.password,
      });

      if (!response.ok) {
        throw new Error(response.error || "Error al cambiar la contraseña");
      }

      // Guardar los datos para mostrarlos en la alerta
      setUserData({
        email: response?.data?.email || "",
        password: data.password,
      });

      toast.success(
        "La contraseña del usuario ha sido actualizada correctamente"
      );

      // Mostrar la alerta con las credenciales
      setShowAlert(true);
      setIsOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error al cambiar la contraseña:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al cambiar la contraseña"
      );
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Cambiar contraseña</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Ingresa una nueva contraseña para este usuario.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Nueva contraseña"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex gap-2 items-center"
                >
                  {isLoading && <Loader2 className="animate-spin" size={16} />}
                  {isLoading ? "Guardando..." : "Guardar cambios"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>      {/* Alerta con credenciales del usuario */}
      <UserCredentialsDialog
        isOpen={showAlert}
        setIsOpen={setShowAlert}
        userData={userData}
        title="Contraseña actualizada con éxito"
        onClose={handleAlertClose}
      />
    </>
  );
};

export default ChangePassword;
