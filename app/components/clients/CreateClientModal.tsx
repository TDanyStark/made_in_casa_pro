"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { createClientAction } from "@/lib/actions/clientsActions";
import { CreateCountrySelect } from "./CreateCountrySelect";
import { useEffect, useState } from "react";

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
      country_id: 0, // Aseguramos que inicie sin valor
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        name: "",
        country_id: 0,
      });
    }
  }, [form, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Crear Cliente</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Cliente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            id="create-client"
            onSubmit={form.handleSubmit(async (data) => {
              const formData = new FormData();
              formData.append("name", data.name);
              formData.append("country_id", data.country_id.toString());
              await createClientAction(formData);
            })}
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
                  <FormMessage className="text-red-500" />
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
                  <FormMessage className="text-red-500" />
                  {/* Ahora muestra errores */}
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Crear</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateClientModal;
