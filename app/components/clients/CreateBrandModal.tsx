"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect } from "react";

import "@/styles/selects.css";

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
import { ManagerSelect } from "@/components/managers/ManagerSelect";

const formSchema = z.object({
  manager_id: z.coerce.number().int('Se requiere un gerente válido').positive("Se requiere un gerente válido"),
  name: z.string().nonempty("El nombre de la marca es obligatorio"),
});

export type BrandFormData = z.infer<typeof formSchema> & { id?: number };

interface Props {
  clientId?: number;
  openModal: boolean;
  handleModal: (state: boolean) => void;
}

export function CreateBrandModal({ clientId, openModal, handleModal }: Props) {
  const form = useForm<BrandFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  // Item mutations for brands
  const { createItem } = useItemMutations<BrandFormData>("brands");

  const handleSubmit = form.handleSubmit((data) => {
    createItem.mutate(data, {
      onSuccess: () => {
        handleModal(false);
      },
      onError: (error) => {
        console.error("Error creando marca:", error);
      },
    });
  });

  useEffect(() => {
    if (!openModal) {
      form.reset({
        name: "",
      });
    }
  }, [openModal, form]);

  return (
    <>
      <Dialog open={openModal} onOpenChange={handleModal}>
        <DialogContent 
          className="sm:max-w-[525px]"
          tabIndex={undefined}
          >
          <DialogHeader>
            <DialogTitle>Crear Marca</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              id="create-brand"
              onSubmit={handleSubmit}
              className="space-y-4 mt-4"
            >
              <ManagerSelect 
                control={form.control}
                name="manager_id"
                clientId={clientId}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la marca" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="submit"
                  form="create-brand"
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

export default CreateBrandModal;
