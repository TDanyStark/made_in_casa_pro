"use client";

import { useState, useEffect, useCallback } from "react";
import { UserSkillType } from "@/lib/definitions";
import { get, del } from "@/lib/services/apiService";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SkillSelect from "./SkillSelect";
import { Skeleton } from "../ui/skeleton";

interface SkillsByColaboratorProps {
  user_id: number;
  className?: string;
}

const SkillsByColaborator = ({
  user_id,
  className,
}: SkillsByColaboratorProps) => {  
  const [skills, setSkills] = useState<UserSkillType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserSkills = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await get<{ data: UserSkillType[] }>(`users/${user_id}/skills`);
      
      if (response.ok && response.data) {
        setSkills(response.data.data);
      } else {
        console.error("Error fetching user skills:", response.error);
        toast.error("Error al obtener las habilidades del usuario");
      }
    } catch (error) {
      console.error("Error fetching user skills:", error);
      toast.error("Error al obtener las habilidades del usuario");
    } finally {
      setIsLoading(false);
    }
  }, [user_id]);

  const handleSkillAdded = () => {
    fetchUserSkills();
  };

  const handleRemoveSkill = async (skillId: number) => {
    try {
      const response = await del(`users/${user_id}/skills?skill_id=${skillId}`);
      
      if (response.ok) {
        // Remove the skill from the local state
        setSkills((prevSkills) => prevSkills.filter((skill) => skill.skill_id !== skillId));
        toast.success("Habilidad eliminada correctamente");
      } else {
        console.error("Error removing skill:", response.error);
        toast.error("Error al eliminar la habilidad");
      }
    } catch (error) {
      console.error("Error removing skill:", error);
      toast.error("Error al eliminar la habilidad");
    }
  };

  useEffect(() => {
    if (user_id) {
      fetchUserSkills();
    }
  }, [user_id, fetchUserSkills]);

  return (
    <div className={className}>
      <div className="mb-4">
        <SkillSelect 
          user_id={user_id} 
          label="Añadir habilidades" 
          onSkillAdded={handleSkillAdded} 
        />
      </div>
      
      <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">Habilidades</h3>
        
        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-6 w-32 mb-2" />
          </div>
        ) : skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge 
                key={skill.skill_id} 
                variant="secondary"
                className="py-1 px-3 flex items-center gap-1 text-xs"
              >
                {skill.skill_name}
                <button 
                  onClick={() => handleRemoveSkill(skill.skill_id)}
                  className="ml-1 hover:text-destructive focus:outline-none"
                  title="Eliminar habilidad"
                >
                  <XIcon size={14} />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay habilidades añadidas</p>
        )}
      </div>
    </div>
  );
};

export default SkillsByColaborator;
