"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState } from "react";

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
import Select from "react-select";
import useGetItems from "@/hooks/useGetItems";

const formSchema = z.object({
  manager_id: z.coerce.number().int().positive("Se requiere un gerente válido"),
  name: z.string().nonempty("El nombre de la marca es obligatorio"),
});

type BrandFormData = z.infer<typeof formSchema> & { id?: number };

interface Props {
  openModal: boolean;
  handleModal: (state: boolean) => void;
}

export function CreateBrandModal({ openModal, handleModal }: Props) {
  const form = useForm<BrandFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const { data: managers, isLoading: isLoadingManagers } = useGetItems("managers");
  console.log("Managers:", managers);
  const [managerOptions, setManagerOptions] = useState<{ value: number; label: string }[]>([]);

  useEffect(() => {
    if (managers && Array.isArray(managers)) {
      const options = managers.map((manager) => ({
        value: manager.id,
        label: manager.name,
      }));
      setManagerOptions(options);
    }
  }, [managers]);

  const { createItem } = useItemMutations<BrandFormData>("brands");

  const handleSubmit = form.handleSubmit((data) => {
    console.log(data);
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
    <Dialog open={openModal} onOpenChange={handleModal}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Crear Marca</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="create-brand"
            onSubmit={handleSubmit}
            className="space-y-4 mt-4"
          >
            <FormField
              control={form.control}
              name="manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gerente</FormLabel>
                  <FormControl>
                    <Select
                      isLoading={isLoadingManagers}
                      options={managerOptions}
                      placeholder="Selecciona un gerente"
                      value={managerOptions.find((option) => option.value === field.value)}
                      onChange={(selectedOption) => {
                        field.onChange(selectedOption?.value);
                      }}
                      className="react-select-container"
                      classNamePrefix="react-select"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
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
  );
}

export default CreateBrandModal;
