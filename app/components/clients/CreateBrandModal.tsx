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
import CreatableSelect from "react-select/creatable";
import useGetItems from "@/hooks/useGetItems";
import CreateManagerModal from "./CreateManagerModal";
import { ManagerType } from "@/lib/definitions";

const formSchema = z.object({
  manager_id: z.coerce.number().int().positive("Se requiere un gerente válido"),
  name: z.string().nonempty("El nombre de la marca es obligatorio"),
});

type BrandFormData = z.infer<typeof formSchema> & { id?: number };

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

  const { data: managers, isLoading: isLoadingManagers } = useGetItems("managers");
  const [managerOptions, setManagerOptions] = useState<{ value: number; label: string }[]>([]);
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [newManagerName, setNewManagerName] = useState("");

  // Item mutations for brands
  const { createItem } = useItemMutations<BrandFormData>("brands");

  useEffect(() => {
    if (managers && Array.isArray(managers)) {
      const options = managers.map((manager) => ({
        value: manager.id,
        label: manager.name,
      }));
      setManagerOptions(options);
    }
  }, [managers]);

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

  const handleCreateManager = (inputValue: string) => {
    setIsCreatingManager(true);
    setNewManagerName(inputValue);
  };

  const handleManagerCreated = (manager: ManagerType) => {
    // Add the new manager to the options
    const newOption = {
      value: manager.id as number,
      label: manager.name,
    };
    
    setManagerOptions((prev) => [...prev, newOption]);
    
    // Select the newly created manager
    form.setValue("manager_id", manager.id as number);
    
    setIsCreatingManager(false);
  };

  useEffect(() => {
    if (!openModal) {
      form.reset({
        name: "",
      });
      setIsCreatingManager(false);
    }
  }, [openModal, form]);

  return (
    <>
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
                      <CreatableSelect
                        isLoading={isLoadingManagers}
                        options={managerOptions}
                        placeholder="Selecciona o crea un gerente"
                        value={managerOptions.find((option) => option.value === field.value)}
                        onChange={(selectedOption) => {
                          field.onChange(selectedOption?.value);
                        }}
                        onCreateOption={handleCreateManager}
                        formatCreateLabel={(inputValue) => `Crear gerente "${inputValue}"`}
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

      {clientId && (
        <CreateManagerModal
          clientId={clientId}
          openModal={isCreatingManager}
          handleModal={(state) => setIsCreatingManager(state)}
          onSuccess={handleManagerCreated}
          initialName={newManagerName}
        />
      )}
    </>
  );
}

export default CreateBrandModal;
