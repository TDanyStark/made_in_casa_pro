'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { BrandSelect } from '@/components/brands/BrandSelect'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

// Definir el esquema de validación
const formSchema = z.object({
  id: z.number().optional(),
  brand_id: z.number(),
  name: z.string(),
});

export type FormDataTest = z.infer<typeof formSchema>;

export default function BrandSelectDemo() {
  const [selectedBrand, setSelectedBrand] = useState<{ id: number, name: string } | null>(null);

  // Inicializar el formulario con react-hook-form
  const form = useForm<FormDataTest>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brand_id: undefined,
      name: '',
    },
  });

  // Función que maneja el envío del formulario
  const onSubmit = (data: FormDataTest) => {
    console.log('Formulario enviado:', data);
    // Buscar el nombre de la marca seleccionada
    if (data.brand_id) {
      setSelectedBrand({
        id: data.brand_id,
        name: form.getValues('name') || 'Nombre no disponible'
      });
    }
  };

  // Manejar cambio de marca seleccionada
  const handleBrandChange = (brandId: number | undefined) => {
    if (brandId) {
      console.log('Marca seleccionada ID:', brandId);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Formulario de Selección de Marca</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="brand_id"
              render={({  }) => (
                <FormItem>
                  <FormLabel>Selecciona una Marca</FormLabel>
                  <FormControl>
                    <BrandSelect
                      form={form}
                      control={form.control}
                      name="brand_id"
                      label="Marca"
                      placeholder="Buscar o crear una marca"
                      onChange={handleBrandChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit">Guardar Selección</Button>
          </form>
        </Form>
      </CardContent>
      {selectedBrand && (
        <CardFooter className="flex flex-col items-start">
          <p className="text-sm font-medium">Marca seleccionada:</p>
          <div className="bg-primary-foreground p-2 rounded mt-1 w-full">
            <p><strong>ID:</strong> {selectedBrand.id}</p>
            <p><strong>Nombre:</strong> {selectedBrand.name}</p>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}