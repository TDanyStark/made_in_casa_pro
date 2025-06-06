"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { CreateCountrySelect } from "./CreateCountrySelect";
import useItemMutations from "@/hooks/useItemsMutation";
import { ClientType } from "@/lib/definitions";

const formSchema = z.object({
  name: z.string().nonempty("El nombre es obligatorio"),
  country_id: z.coerce.number().refine((val) => !isNaN(val) && val > 0, {
    message: "Debe de escoger un pais",
  }),
});

interface ModalControlProps {
  isOpen: boolean;
  setOpen: (state: boolean) => void;
}

interface Props {
  modalControl?: ModalControlProps;
  onSuccess?: (client: ClientType) => void;
  initialName?: string;
}

export function CreateClientModal({ modalControl, onSuccess, initialName = "" }: Props = {}) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialName,
      country_id: 0,
    },
  });

  const router = useRouter();
  const { createItem } = useItemMutations<ClientType>("clients");

  // Use either provided modal control or local state
  const isOpen = modalControl?.isOpen ?? open;
  const setIsOpen = modalControl?.setOpen ?? setOpen;

  const handleSubmit = form.handleSubmit((data) => {
    createItem.mutate(
      { ...data, id: 0 },
      {
        onSuccess: (data) => {
          setIsOpen(false);
          if (onSuccess && data) {
            onSuccess(data as ClientType);
          } else {
            router.refresh();
          }
        },
        onError: (error) => {
          console.error("Error creando cliente:", error);
        },
      }
    );
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset({
        name: initialName,
        country_id: 0,
      });
    } else if (initialName) {
      form.setValue("name", initialName);
    }
  }, [isOpen, initialName, form]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!modalControl && (
        <DialogTrigger asChild>
          <Button variant="default">Crear Cliente</Button>
        </DialogTrigger>
      )}
      <DialogContent 
        className="sm:max-w-[425px]"
        tabIndex={undefined}
        aria-describedby={undefined}
        >
        <DialogHeader>
          <DialogTitle>Crear Cliente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="create-client"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSubmit(e);
            }}
            className="space-y-4 mt-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Empresa asombrosa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>País</FormLabel>
                  <FormControl>
                    <CreateCountrySelect field={field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={createItem.isPending} className="flex gap-2">
                {createItem.isPending && <Loader2 className="animate-spin mr-2" />}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateClientModal;
