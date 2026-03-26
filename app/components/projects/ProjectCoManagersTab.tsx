"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Select from "react-select";
import { toast } from "sonner";
import { post, del, get } from "@/lib/services/apiService";
import { ManagerType, ApiResponseWithPagination } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserMinus, UserPlus } from "lucide-react";

interface Manager {
  id: number;
  name: string;
  email: string;
}

interface ManagerOption {
  value: number;
  label: string;
  email: string;
}

interface Props {
  projectId: number;
  mainManagerId: number;
  coManagers: Manager[];
  canEdit: boolean;
}

export function ProjectCoManagersTab({ projectId, mainManagerId, coManagers, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<ManagerOption | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: allManagers = [], isLoading } = useQuery({
    queryKey: ["managers-all"],
    queryFn: async () => {
      const res = await get<ApiResponseWithPagination<ManagerType[]>>("managers?limit=200");
      if (!res.ok || !res.data) return [];
      return ((res.data as unknown as { data: ManagerType[] }).data ?? [])
        .filter((m) => m.id !== mainManagerId && !coManagers.find((cm) => cm.id === m.id!))
        .map((m): ManagerOption => ({ value: m.id!, label: m.name, email: m.email }));
    },
    enabled: canEdit,
  });

  const handleAdd = async () => {
    if (!selectedOption) return;
    setAdding(true);
    try {
      const res = await post(`projects/${projectId}/managers`, {
        manager_id: selectedOption.value,
      });
      if (!res.ok) throw new Error(res.error);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setSelectedOption(null);
      toast.success(`${selectedOption.label} agregado como co-responsable`);
    } catch {
      toast.error("Error al agregar co-responsable");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (managerId: number, name: string) => {
    try {
      const res = await del(`projects/${projectId}/managers`, { manager_id: managerId });
      if (!res.ok) throw new Error(res.error);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success(`${name} removido`);
    } catch {
      toast.error("Error al remover co-responsable");
    }
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Select<ManagerOption>
              options={allManagers}
              value={selectedOption}
              onChange={(opt) => setSelectedOption(opt as ManagerOption | null)}
              isLoading={isLoading}
              placeholder="Buscar gerente para agregar..."
              classNamePrefix="react-select"
            />
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selectedOption || adding}
            size="default"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Agregar
          </Button>
        </div>
      )}

      {coManagers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8 border rounded-md border-dashed">
          Este proyecto no tiene co-responsables.
        </p>
      ) : (
        <div className="space-y-2">
          {coManagers.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div>
                  <p className="font-medium text-sm">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                {canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Remover co-responsable?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se quitará a {m.name} como co-responsable del proyecto.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleRemove(m.id, m.name)}
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
