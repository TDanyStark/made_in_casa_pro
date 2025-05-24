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
import { ManagerSelect } from "@/components/managers/ManagerSelect";
import { BusinessUnitBrandSelect } from "@/components/brands/BusinessUnitBrandSelect";
import { get } from "@/lib/services/apiService";
import { BrandType, ManagerType } from "@/lib/definitions";
import { toast } from "sonner";
import { Skeleton } from "../ui/skeleton";

const formSchema = z.object({
  manager_id: z.coerce
    .number()
    .int("Se requiere un gerente válido")
    .positive("Se requiere un gerente válido"),
  name: z.string().nonempty("El nombre de la marca es obligatorio"),
  business_unit_id: z.coerce.number().int().positive().optional(),
});

export type BrandFormData = z.infer<typeof formSchema>;

interface Props {
  clientId?: number;
  openModal: boolean;
  initialName?: string;
  handleModal: (state: boolean) => void;
  onSuccess?: (brand: BrandType) => void;
}

export function CreateBrandModal({
  clientId,
  openModal,
  handleModal,
  onSuccess,
  initialName = "",
}: Props) {
  const [showBusinessUnit, setShowBusinessUnit] = useState<boolean>(false);
  const [loadingManagerData, setLoadingManagerData] = useState<boolean>(false);

  const form = useForm<BrandType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialName,
      business_unit_id: undefined,
    },
  });
  const managerId = form.watch("manager_id");

  useEffect(() => {
    // hacer peticion fetch a managers/[id] para obtener el cliente
    const fetchManager = async () => {
      try {
        setLoadingManagerData(true);
        const response = await get<ManagerType>(`/managers/${managerId}`);
        if (!response.ok) {
          toast.error(
            "Error al obtener el gerente. Por favor, inténtalo de nuevo más tarde."
          );
          return;
        }
        const data = response.data;
        const accept_business_units = data?.client_info?.accept_business_units;
        setShowBusinessUnit(accept_business_units || false);
      } catch (error) {
        console.error("Error fetching manager data:", error);
        toast.error("Error al obtener información del gerente");
      } finally {
        setLoadingManagerData(false);
      }
    };

    if (managerId) {
      fetchManager();
    } else {
      setShowBusinessUnit(false);
    }
  }, [managerId]);

  useEffect(() => {
    if (!openModal) {
      form.reset({
        name: initialName,
        business_unit_id: undefined,
      });
      setShowBusinessUnit(false);
    }
    if (initialName) {
      form.setValue("name", initialName);
    }
  }, [openModal, form, initialName]);

  // Item mutations for brands
  const { createItem } = useItemMutations<BrandType>("brands");

  const handleSubmit = form.handleSubmit((data) => {
    // If business_unit is not shown, ensure it's not included in the data
    const submitData = showBusinessUnit
      ? data
      : { ...data, business_unit_id: undefined };

    createItem.mutate(submitData, {
      onSuccess: (data) => {
        if (onSuccess && data) {
          onSuccess(data as BrandType);
        }
        handleModal(false);
      },
      onError: (error) => {
        console.error("Error creando marca:", error);
      },
    });
  });

  return (
    <>
      <Dialog open={openModal} onOpenChange={handleModal}>
        <DialogContent
          className="sm:max-w-[525px]"
          tabIndex={undefined}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Crear Marca</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              id="create-brand"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit(e);
              }}
              className="space-y-4 mt-4"
            >
              <ManagerSelect
                form={form}
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
              {loadingManagerData && (
                <div className="space-y-2">
                  <Skeleton className="h-[14px] w-1/2" />
                  <Skeleton className="h-[38px] w-full" />
                </div>
              )}
              {showBusinessUnit && !loadingManagerData && (
                <BusinessUnitBrandSelect
                  form={form}
                  control={form.control}
                  name="business_unit_id"
                />
              )}

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
