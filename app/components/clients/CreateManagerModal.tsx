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

import { RichTextEditor } from "./RichTextEditor";
import { ManagerType } from "@/lib/definitions";


const formSchema = z.object({
  client_id: z.coerce.number().int().positive("Se requiere un cliente válido"),
  name: z.string().nonempty("El nombre es obligatorio"),
  email: z
    .string()
    .email("Correo electrónico inválido")
    .nonempty("El correo electrónico es obligatorio"),
  phone: z.string().nonempty("El teléfono es obligatorio"),
  biography: z.string(),
});

type ManagerFormData = z.infer<typeof formSchema> & { id?: number };

interface Props{
  clientId: number;
  openModal: boolean;
  handleModal: (state: boolean) => void;
}

// Rich Text Editor Component
export function CreateManagerModal({ clientId, openModal, handleModal }: Props) {
  const form = useForm<ManagerFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: clientId,
      name: "",
      email: "",
      phone: "",
      biography: "",
    },
  });

  const { createItem } = useItemMutations<ManagerType>("managers");

  const handleSubmit = form.handleSubmit((data) => {
    console.log(data);
    createItem.mutate(data, {
      onSuccess: () => {
        handleModal(false);
      },
      onError: (error) => {
        console.error("Error creando gerente:", error);
      },
    });
  });

  useEffect(() => {
    if (!openModal) {
      form.reset({
        client_id: clientId,
        name: "",
        email: "",
        phone: "",
        biography: "",
      });
    }
  }, [openModal, form, clientId]);

  return (
    <Dialog open={openModal} onOpenChange={handleModal}>
      <DialogContent className="sm:max-w-[525px]">
        {" "}
        {/* Increased width for better editor experience */}
        <DialogHeader>
          <DialogTitle>Crear Gerente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="create-manager"
            onSubmit={handleSubmit}
            className="space-y-4 mt-4"
          >
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
                      value={field.value}
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
                type="submit"
                form="create-manager"
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
  );
}

export default CreateManagerModal;
