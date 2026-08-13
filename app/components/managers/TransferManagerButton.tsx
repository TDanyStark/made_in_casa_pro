"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import TransferManagerDialog from "./TransferManagerDialog";

/** Disparador cliente del modal de traslado (la página del gerente es server). */
export default function TransferManagerButton({
  managerId,
}: {
  managerId: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ArrowRightLeft className="h-4 w-4 mr-2" />
        Trasladar a otro cliente
      </Button>

      <TransferManagerDialog
        managerId={managerId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
