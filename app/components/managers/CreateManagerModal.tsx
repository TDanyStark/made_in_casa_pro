"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import useItemMutations from "@/hooks/useItemsMutation";

import { ClientSelect } from "@/components/clients/ClientSelect";
import { ManagerType } from "@/lib/definitions";
import { RichTextEditor } from "../clients/RichTextEditor";

const formSchema = z.object({
  client_id: z.coerce.number().int().positive("Se requiere un cliente válido"),
  name: z.string().nonempty("El nombre es obligatorio"),
  email: z
    .string()
    .email("Correo electrónico inválido")
    .nonempty("El correo electrónico es obligatorio"),
  phone: z.string().nonempty("El teléfono es obligatorio"),
  biography: z.string().optional(),
});

interface Props {
  clientId?: number;
  openModal: boolean;
  handleModal: (state: boolean) => void;
  onSuccess?: (manager: ManagerType) => void;
  initialName?: string;
}

// Rich Text Editor Component
export function CreateManagerModal({
  clientId,
  openModal,
  handleModal,
  onSuccess,
  initialName = "",
}: Props) {
  const form = useForm<ManagerType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: clientId || 0,
      name: initialName,
      email: "",
      phone: "",
      biography: "",
    },
  });
  const { createItem } = useItemMutations<ManagerType>("managers");

  useEffect(() => {
    if (!openModal) {
      form.reset({
        client_id: clientId || 0,
        name: initialName,
        email: "",
        phone: "",
        biography: "",
      });
    } 
    if (initialName) {
      form.setValue("name", initialName);
    }
  }, [openModal, form, clientId, initialName]);

  const handleSubmit = form.handleSubmit((data) => {
    console.log(data);
    createItem.mutate(data, {
      onSuccess: (data) => {
        if (onSuccess && data) {
          onSuccess(data as ManagerType);
        }
        handleModal(false);
      },
      onError: (error) => {
        console.error("Error creando gerente:", error);
      },
    });
  });

  return (
    <>
      <Dialog open={openModal} onOpenChange={handleModal}>
        <DialogContent 
          className="sm:max-w-[525px]" 
          tabIndex={undefined}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Crear Gerente</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              id="create-manager"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit(e);
              }}
              className="space-y-4 mt-4"
            >
              {!clientId && (
                <ClientSelect
                  control={form.control}
                  name="client_id"
                />
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del gerente" {...field} />
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
                    <FormLabel>Correo electrónico</FormLabel>
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 234 567 8901" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="biography"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biografía</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Información sobre el gerente..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit(e);
                  }}
                  disabled={createItem.isPending}
                  className="flex gap-2"
                >
                  {createItem.isPending && (
                    <Loader2 className="animate-spin mr-2" />
                  )}
                  Crear
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CreateManagerModal;
