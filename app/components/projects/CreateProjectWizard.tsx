"use client";

import { useProjectWizard } from "@/hooks/useProjectWizard";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/services/apiService";
import { ProjectPreviewCard } from "./ProjectPreviewCard";
import { WizardStep1Basics } from "./wizard/WizardStep1Basics";
import { WizardStep2Manager } from "./wizard/WizardStep2Manager";
import { WizardStep3Products } from "./wizard/WizardStep3Products";
import { WizardStep4Tasks } from "./wizard/WizardStep4Tasks";
import { WizardStep5Campaign } from "./wizard/WizardStep5Campaign";
import { WizardStep6Confirm } from "./wizard/WizardStep6Confirm";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { WizardState } from "@/hooks/useProjectWizard";

const STEPS = [
  { label: "Básicos" },
  { label: "Co-responsables" },
  { label: "Productos" },
  { label: "Tareas" },
  { label: "Campaña" },
  { label: "Confirmar" },
];

export function CreateProjectWizard() {
  const { state, update, currentStep, next, prev, goTo } = useProjectWizard();

  // Get current user session for created_by name in wizard
  const { data: me } = useQuery({
    queryKey: ["current-user-me"],
    queryFn: async () => {
      const res = await get<{ id: number; name: string }>("me");
      return res.ok ? (res.data as unknown as { id: number; name: string }) : null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Sync current user to state if not set
  useEffect(() => {
    if (me && !state.created_by) {
      update({
        created_by: me.id,
        created_by_name: me.name
      });
    }
  }, [me, state.created_by, update]);

  const handleNext = (data: Partial<WizardState>) => {
    update(data);
    next();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WizardStep1Basics state={state} onNext={handleNext} />;
      case 1:
        return <WizardStep2Manager state={state} onNext={handleNext} onBack={prev} />;
      case 2:
        return <WizardStep3Products state={state} onNext={handleNext} onBack={prev} />;
      case 3:
        return <WizardStep4Tasks state={state} onNext={handleNext} onBack={prev} update={update} />;
      case 4:
        return <WizardStep5Campaign state={state} onNext={handleNext} onBack={prev} />;
      case 5:
        return <WizardStep6Confirm state={state} onBack={prev} />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
      {/* Left: form */}
      <div className="space-y-8">
        {/* Step indicator */}
        <nav aria-label="Progreso del formulario">
          <ol className="flex items-center">
            {STEPS.map((step, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <li key={step.label} className="flex-1 flex items-center">
                  <button
                    type="button"
                    disabled={index > currentStep}
                    onClick={() => index < currentStep && goTo(index)}
                    className={cn(
                      "flex flex-col items-center gap-1 group w-full",
                      index > currentStep && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-all",
                        isCompleted
                          ? "border-primary bg-primary text-primary-foreground"
                          : isCurrent
                          ? "border-primary bg-background text-primary"
                          : "border-muted-foreground/30 bg-background text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium hidden sm:block",
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </button>

                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 flex-1 mx-1 transition-all",
                        index < currentStep ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step content card */}
        <div className="rounded-xl border bg-card shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-6">
            Paso {currentStep + 1}: {STEPS[currentStep].label}
          </h2>
          {renderStep()}
        </div>
      </div>

      {/* Right: live preview */}
      <aside>
        <ProjectPreviewCard state={state} />
      </aside>
    </div>
  );
}

export default CreateProjectWizard;
