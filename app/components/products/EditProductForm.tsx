"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { patch } from "@/lib/services/apiService";
import { ProductType } from "@/lib/definitions";
import CategorySelect from "./CategorySelect";

const formSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional().nullable(),
  category_id: z.number().optional().nullable(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  product: ProductType;
}

export default function EditProductForm({ product }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product.name,
      description: product.description ?? "",
      category_id: product.category_id ?? null,
      is_active: Boolean(product.is_active),
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const res = await patch(`products/${product.id}`, {
        ...values,
        is_active: values.is_active ? 1 : 0,
      });
      if (res.ok) {
        toast.success("Producto actualizado");
        queryClient.invalidateQueries({ queryKey: ["products"] });
        router.push(`/products/${product.id}`);
      } else {
        toast.error(res.error || "Error al actualizar el producto");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Video institucional" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descripción del producto..."
                  rows={4}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <FormControl>
                <CategorySelect
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <FormLabel className="mt-0">Activo</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="flex gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/products/${product.id}`)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
