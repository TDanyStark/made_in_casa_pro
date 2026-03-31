"use client";

import { useState, useCallback } from "react";
import { ProductType } from "@/lib/definitions";

export interface WizardManager {
  id: number;
  name: string;
  email: string;
}

export interface TaskOverride {
  template_id: number;
  title?: string;
  assigned_user_id?: number | null;
  assign_to_commercial?: number;
  order_index?: number;
}

export interface ExtraTask {
  // Negative temp IDs to distinguish from template tasks (e.g. -1, -2, -3...)
  // These are LOCAL only — the real ID is assigned by the DB after creation
  localId: number;
  title: string;
  assigned_user_id: number | null;
  assign_to_commercial: number;
  area_id: number | null;
  task_type: "execution" | "validation";
  order_index: number;
}

export interface WizardState {
  // Step 1 — basics (brand auto-resolves manager + client)
  title: string;
  brand_id: number | null;
  brand_name: string;
  client_id: number | null;
  client_name: string;
  created_by: number | null;
  created_by_name: string;

  // Manager auto-assigned from brand (not manually selected)
  manager_id: number | null;
  manager_name: string;
  manager_email: string;

  // Step 2 — co-managers (optional)
  co_manager_ids: number[];
  co_manager_names: string[];
  co_manager_emails: string[];

  // Step 3 — product (single)
  product: ProductType | null;

  // Step 4 — task overrides (user customizations before project creation)
  task_overrides: TaskOverride[];
  extra_tasks: ExtraTask[];
  removed_template_ids: number[];

  // Step 5 — campaign
  campaign_id: number | null;
  campaign_name: string;

  // Step 6 — drive & notes
  notes: string;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
}

const INITIAL_STATE: WizardState = {
  title: "",
  brand_id: null,
  brand_name: "",
  client_id: null,
  client_name: "",
  created_by: null,
  created_by_name: "",
  manager_id: null,
  manager_name: "",
  manager_email: "",
  co_manager_ids: [],
  co_manager_names: [],
  co_manager_emails: [],
  product: null,
  task_overrides: [],
  extra_tasks: [],
  removed_template_ids: [],
  campaign_id: null,
  campaign_name: "",
  notes: "",
  drive_folder_id: null,
  drive_folder_url: null,
};

export function useProjectWizard() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState(0);

  const update = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const next = useCallback(() => setCurrentStep((s) => Math.min(s + 1, 5)), []);
  const prev = useCallback(() => setCurrentStep((s) => Math.max(s - 1, 0)), []);
  const goTo = useCallback((step: number) => setCurrentStep(step), []);
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setCurrentStep(0);
  }, []);

  return { state, update, currentStep, next, prev, goTo, reset };
}
