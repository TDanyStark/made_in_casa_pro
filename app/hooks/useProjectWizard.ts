"use client";

import { useState } from "react";
import { ProductType } from "@/lib/definitions";

export interface WizardManager {
  id: number;
  name: string;
  email: string;
}

export interface WizardState {
  // Step 1 — basics (brand auto-resolves manager + client)
  title: string;
  brand_id: number | null;
  brand_name: string;
  client_id: number | null;
  client_name: string;

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

  // Step 4 — campaign
  campaign_id: number | null;
  campaign_name: string;

  // Step 5 — drive & notes
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
  manager_id: null,
  manager_name: "",
  manager_email: "",
  co_manager_ids: [],
  co_manager_names: [],
  co_manager_emails: [],
  product: null,
  campaign_id: null,
  campaign_name: "",
  notes: "",
  drive_folder_id: null,
  drive_folder_url: null,
};

export function useProjectWizard() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState(0);

  const update = (partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  const next = () => setCurrentStep((s) => Math.min(s + 1, 4));
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0));
  const goTo = (step: number) => setCurrentStep(step);
  const reset = () => {
    setState(INITIAL_STATE);
    setCurrentStep(0);
  };

  return { state, update, currentStep, next, prev, goTo, reset };
}
