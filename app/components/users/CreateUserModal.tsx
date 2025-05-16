"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
  name: z.string().nonempty("El nombre es obligatorio"),
  email: z.string()
    .email("Ingrese un email válido")
    .nonempty("El email es obligatorio"),
  password: z.string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .nonempty("La contraseña es obligatoria"),
  rol_id: z.coerce
    .number()
    .int("Se requiere un rol válido")
    .positive("Se requiere un rol válido"),
});

// Tipo de datos para el formulario
type UserFormData = z.infer<typeof formSchema>;

export default function CreateUserModal({ isOpen, setIsOpen }: CreateUserModalProps) {
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

  // Hook para mutaciones de usuario
  const { createItem } = useItemMutations<UserFormData>("users", setIsOpen);
  
  // Resetear el formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      form.reset({
        name: "",
        email: "",
        password: "",
        rol_id: undefined,
      });
    }
  }, [isOpen, form]);
  
  // Manejar el envío del formulario
  const handleSubmit = form.handleSubmit((data) => {
    createItem.mutate(data);
  });

  return (
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
                    <Input placeholder="Nombre completo" {...field} />
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
                    <Input type="email" placeholder="correo@ejemplo.com" {...field} />
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
                    <Input type="password" placeholder="********" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rolesLoading ? (
                        <SelectItem value="loading">Cargando roles...</SelectItem>
                      ) : (
                        roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
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
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createItem.isPending} className="flex gap-2">
                {createItem.isPending && <Loader2 className="animate-spin" />}
                Crear usuario
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
