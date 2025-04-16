/* eslint-disable @next/next/no-img-element */
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
import useGetItems from "@/hooks/useGetItems";
import CreatableSelect from "react-select/creatable";

import { RichTextEditor } from "./RichTextEditor";
import { ClientType, ManagerType } from "@/lib/definitions";
import CreateClientModal from "./CreateClientModal";
import { API_FLAG_URL, IMG_FLAG_EXT } from "@/config/constants";

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

export type ManagerFormData = z.infer<typeof formSchema> & { id?: number };

interface Props {
  clientId?: number;
  openModal: boolean;
  handleModal: (state: boolean) => void;
  onSuccess?: (manager: ManagerType) => void;
  initialName?: string;
}

interface ClientOption {
  value: number;
  label: string;
  countryFlag?: string;
}

// Rich Text Editor Component
export function CreateManagerModal({
  clientId,
  openModal,
  handleModal,
  onSuccess,
  initialName = "",
}: Props) {
  const form = useForm<ManagerFormData>({
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
  const { data: clients, isLoading: isLoadingClients } = useGetItems("clients");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");

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

  useEffect(() => {
    if (!openModal) {
      form.reset({
        client_id: clientId || 0,
        name: initialName,
        email: "",
        phone: "",
        biography: "",
      });
      setIsCreatingClient(false);
    } else if (initialName) {
      form.setValue("name", initialName);
    }
  }, [openModal, form, clientId, initialName]);

  useEffect(() => {
    if (clients && Array.isArray(clients)) {
      const options = clients.map((client: ClientType) => ({
        value: client.id,
        label: client.name,
        countryFlag: client.country ? `${API_FLAG_URL}${client.country.flag}${IMG_FLAG_EXT}` : undefined,
      }));
      setClientOptions(options);
    }
  }, [clients]);

  const handleCreateClient = (inputValue: string) => {
    setIsCreatingClient(true);
    setNewClientName(inputValue);
  };

  const handleClientCreated = (newClient: ClientType) => {
    // Add the new client to the options
    const newOption = {
      value: newClient.id,
      label: newClient.name,
    };
    
    setClientOptions((prev) => [...prev, newOption]);
    
    // Select the newly created client
    form.setValue("client_id", newClient.id);
    
    setIsCreatingClient(false);
  };

  // Custom format for option labels to display flags
  const formatOptionLabel = (option: ClientOption) => (
    <div className="flex items-center gap-2">
      <span>{option.label}</span>
      {option.countryFlag && (
        <img 
          src={option.countryFlag} 
          alt="Country flag" 
          width={16} 
          height={12} 
          className="inline-block" 
        />
      )}
    </div>
  );

  return (
    <>
      <Dialog open={openModal} onOpenChange={handleModal}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Crear Gerente</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              id="create-manager"
              onSubmit={handleSubmit}
              className="space-y-4 mt-4"
            >
              {!clientId && (
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <FormControl>
                        <CreatableSelect
                          isLoading={isLoadingClients}
                          options={clientOptions}
                          placeholder="Selecciona o crea un cliente"
                          value={clientOptions.find((option) => option.value === field.value)}
                          onChange={(selectedOption) => {
                            field.onChange(selectedOption?.value);
                          }}
                          onCreateOption={handleCreateClient}
                          formatCreateLabel={(inputValue) => `Crear cliente "${inputValue}"`}
                          formatOptionLabel={formatOptionLabel}
                          className="react-select-container"
                          classNamePrefix="react-select"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
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

      <CreateClientModal 
        modalControl={{
          isOpen: isCreatingClient, 
          setOpen: setIsCreatingClient
        }} 
        initialName={newClientName}
        onSuccess={handleClientCreated}
      />
    </>
  );
}

export default CreateManagerModal;
