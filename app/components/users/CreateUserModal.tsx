"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Copy } from "lucide-react";
import { get } from "@/lib/services/apiService";
import useItemMutations from "@/hooks/useItemsMutation";

interface CreateUserModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface RoleType {
  id: number;
  role: string;
}

// Define el esquema de validación con Zod
const formSchema = z.object({
  id: z.number().optional(),
  name: z.string().nonempty("El nombre es obligatorio"),
  email: z
    .string()
    .email("Ingrese un email válido")
    .nonempty("El email es obligatorio"),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .nonempty("La contraseña es obligatoria"),
  rol_id: z.coerce
    .number()
    .int("Se requiere un rol válido")
    .positive("Se requiere un rol válido"),
});

// Tipo de datos para el formulario
type UserFormData = z.infer<typeof formSchema>;

export default function CreateUserModal({
  isOpen,
  setIsOpen,
}: CreateUserModalProps) {
  // Estado para la alerta y los datos del usuario creado
  const [showAlert, setShowAlert] = useState(false);
  const [createdUserData, setCreatedUserData] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Función para generar contraseña
  const generatePassword = (name: string) => {
    if (!name) return "";
    const cleanName = name.split(" ")[0].toLowerCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000); // número de 4 dígitos
    return `${cleanName}${randomNum}`;
  };

  // Función para copiar credenciales
  const copyCredentials = () => {
    if (createdUserData) {
      const textToCopy = `Email: ${createdUserData.email}\nContraseña: ${createdUserData.password}`;
      navigator.clipboard.writeText(textToCopy);
    }
  };

  // Inicializar el formulario con React Hook Form y Zod
  const form = useForm<UserFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      rol_id: undefined,
    },
  });

  // Consulta para obtener roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await get<RoleType[]>("roles");
      if (!response.ok) {
        throw new Error("Error al cargar roles");
      }
      return response.data;
    },
  });
  // Hook para mutaciones de usuario con callback onSuccess modificado
  const { createItem } = useItemMutations<UserFormData>("users", () => {
    // No cerramos el modal inmediatamente, primero mostramos la alerta
    const userData = form.getValues();
    setCreatedUserData({
      email: userData.email,
      password: userData.password,
    });
    setShowAlert(true);
  });

  // Resetear el formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      form.reset({
        name: "",
        email: "",
        password: "",
        rol_id: undefined,
      });
      setShowAlert(false);
      setCreatedUserData(null);
    }
  }, [isOpen, form]);

  // Función para generar contraseña al cambiar el nombre
  const handleNameChange = (value: string) => {
    form.setValue("name", value);
    if (value) {
      const generatedPassword = generatePassword(value);
      form.setValue("password", generatedPassword);
    }
  };

  // Manejar cierre de alerta y modal
  const handleAlertClose = () => {
    setShowAlert(false);
    setIsOpen(false);
  };

  // Manejar el envío del formulario
  const handleSubmit = form.handleSubmit((data) => {
    createItem.mutate(data);
  });
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo usuario
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nombre completo"
                        {...field}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="correo@ejemplo.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contraseña generada automáticamente"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rol_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rolesLoading ? (
                          <SelectItem value="loading">
                            Cargando roles...
                          </SelectItem>
                        ) : (
                          roles?.map((role) => (
                            <SelectItem
                              key={role.id}
                              value={role.id.toString()}
                            >
                              {role.role}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createItem.isPending}
                  className="flex gap-2"
                >
                  {createItem.isPending && <Loader2 className="animate-spin" />}
                  Crear usuario
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>{" "}
      {/* Alerta con credenciales del usuario */}
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Usuario creado con éxito</AlertDialogTitle>
            <AlertDialogDescription>
              Guarda estas credenciales:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-md mt-2 space-y-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-base">{createdUserData?.email}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Contraseña:</span>
              <span className="text-base">{createdUserData?.password}</span>
            </div>
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogAction asChild>
              <Button
                className="flex gap-2 items-center"
                onClick={copyCredentials}
              >
                <Copy size={16} />
                Copiar credenciales
              </Button>
            </AlertDialogAction>
            <AlertDialogAction asChild>
              <Button onClick={handleAlertClose}>Cerrar</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
