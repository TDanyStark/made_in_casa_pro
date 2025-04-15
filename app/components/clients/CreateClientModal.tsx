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
    message: "No puede estar vacío",
  }),
});

export function CreateClientModal() {
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      country_id: 0,
    },
  });

  const router = useRouter();
  const { createItem } = useItemMutations<ClientType>("clients");

  const handleSubmit = form.handleSubmit((data) => {
    createItem.mutate(
      { ...data, id: 0 },
      {
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
        onError: (error) => {
          console.error("Error creando cliente:", error);
        },
      }
    );
  });

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="default">Crear Cliente</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Cliente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="create-client"
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
