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

const formSchema = z.object({
  manager_id: z.coerce.number().int().positive("Se requiere un gerente válido"),
  name: z.string().nonempty("El nombre de la marca es obligatorio"),
});

// Additional form schema for creating a new manager
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const newManagerFormSchema = z.object({
  client_id: z.coerce.number().int().positive("Se requiere un cliente válido"),
  name: z.string().nonempty("El nombre del gerente es obligatorio"),
  email: z.string().email("Formato de correo inválido").nonempty("El correo electrónico es obligatorio"),
  phone: z.string().nonempty("El teléfono es obligatorio"),
});

type BrandFormData = z.infer<typeof formSchema> & { id?: number };
type NewManagerData = z.infer<typeof newManagerFormSchema>  & { id?: number };

interface Props {
  clientId?: number;
  openModal: boolean;
  handleModal: (state: boolean) => void;
}

export function CreateBrandModal({clientId, openModal, handleModal }: Props) {
  const form = useForm<BrandFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const { data: managers, isLoading: isLoadingManagers } = useGetItems("managers");
  const [managerOptions, setManagerOptions] = useState<{ value: number; label: string }[]>([]);
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [newManagerFormData, setNewManagerFormData] = useState<NewManagerData>({
    client_id: clientId || 0,
    name: "",
    email: "",
    phone: "",
  });
  const [newManagerErrors, setNewManagerErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  }>({});

  // Item mutations for brands and managers
  const { createItem } = useItemMutations<BrandFormData>("brands");
  const { createItem: createManager } = useItemMutations<NewManagerData>("managers");

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
    setNewManagerFormData({
      client_id: clientId || 0,
      name: inputValue,
      email: "",
      phone: "",
    });
  };

  const validateNewManagerData = (): boolean => {
    const errors: {
      name?: string;
      email?: string;
      phone?: string;
    } = {};
    
    if (!newManagerFormData.name) {
      errors.name = "El nombre del gerente es obligatorio";
    }
    
    if (!newManagerFormData.email) {
      errors.email = "El correo electrónico es obligatorio";
    } else if (!/^\S+@\S+\.\S+$/.test(newManagerFormData.email)) {
      errors.email = "Formato de correo inválido";
    }
    
    if (!newManagerFormData.phone) {
      errors.phone = "El teléfono es obligatorio";
    }
    
    setNewManagerErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitNewManager = () => {
    if (!validateNewManagerData()) {
      return;
    }
    
    // Using a default client_id of 1 - this should be updated to use the correct client_id
    // You may want to pass clientId as a prop to this component
    const managerData = {
      client_id: clientId || 1,
      name: newManagerFormData.name,
      email: newManagerFormData.email,
      phone: newManagerFormData.phone,
      biography: "" // Optional field
    };
    
    createManager.mutate(managerData, {
      onSuccess: (data) => {
        const newManager = data as { id: number; name: string };
        // Add the new manager to the options
        const newOption = {
          value: newManager.id,
          label: newManager.name,
        };
        
        setManagerOptions((prev) => [...prev, newOption]);
        
        // Select the newly created manager
        form.setValue("manager_id", newManager.id);
        
        setIsCreatingManager(false);
      },
      onError: (error) => {
        console.error("Error creando gerente:", error);
      },
    });
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
            {isCreatingManager ? (
              <div className="space-y-4">
                <h3 className="font-semibold">Crear Nuevo Gerente</h3>
                
                <div>
                  <FormLabel>Nombre</FormLabel>
                  <Input 
                    value={newManagerFormData.name}
                    onChange={(e) => setNewManagerFormData(prev => ({...prev, name: e.target.value}))}
                    placeholder="Nombre del gerente"
                  />
                  {newManagerErrors.name && <p className="text-sm text-red-500 mt-1">{newManagerErrors.name}</p>}
                </div>
                
                <div>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <Input 
                    value={newManagerFormData.email}
                    onChange={(e) => setNewManagerFormData(prev => ({...prev, email: e.target.value}))}
                    placeholder="correo@ejemplo.com"
                    type="email"
                  />
                  {newManagerErrors.email && <p className="text-sm text-red-500 mt-1">{newManagerErrors.email}</p>}
                </div>
                
                <div>
                  <FormLabel>Teléfono</FormLabel>
                  <Input 
                    value={newManagerFormData.phone}
                    onChange={(e) => setNewManagerFormData(prev => ({...prev, phone: e.target.value}))}
                    placeholder="Número de teléfono"
                  />
                  {newManagerErrors.phone && <p className="text-sm text-red-500 mt-1">{newManagerErrors.phone}</p>}
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreatingManager(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={submitNewManager}
                    disabled={createManager.isPending}
                  >
                    {createManager.isPending && <Loader2 className="animate-spin mr-2" />}
                    Guardar Gerente
                  </Button>
                </div>
              </div>
            ) : (
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
            )}

            {!isCreatingManager && (
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
            )}

            {!isCreatingManager && (
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
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateBrandModal;
