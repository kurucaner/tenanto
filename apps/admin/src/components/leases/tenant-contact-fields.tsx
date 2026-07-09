import { memo } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { TTenantContactFormValues } from "./tenant-contact-form-schema";

interface TenantContactFieldsProps {
  errors: FieldErrors<TTenantContactFormValues>;
  idPrefix: string;
  register: UseFormRegister<TTenantContactFormValues>;
}

export const TenantContactFields = memo(
  ({ errors, idPrefix, register }: TenantContactFieldsProps) => (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input autoFocus id={`${idPrefix}-name`} {...register("name")} />
        {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-email`}>Email (optional)</Label>
        <Input id={`${idPrefix}-email`} type="email" {...register("tenantEmail")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>Phone (optional)</Label>
        <Input id={`${idPrefix}-phone`} type="tel" {...register("tenantPhone")} />
      </div>
    </>
  )
);
TenantContactFields.displayName = "TenantContactFields";
