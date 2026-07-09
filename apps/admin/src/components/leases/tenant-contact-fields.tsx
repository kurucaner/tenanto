import { memo } from "react";
import { type Control, Controller, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

import type { TTenantContactFormValues } from "./tenant-contact-form-schema";

interface TenantContactFieldsProps {
  control: Control<TTenantContactFormValues>;
  errors: FieldErrors<TTenantContactFormValues>;
  idPrefix: string;
  register: UseFormRegister<TTenantContactFormValues>;
}

export const TenantContactFields = memo(
  ({ control, errors, idPrefix, register }: TenantContactFieldsProps) => (
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
      <Controller
        control={control}
        name="tenantPhone"
        render={({ field }) => (
          <PhoneInput
            id={`${idPrefix}-phone`}
            label="Phone"
            onChange={field.onChange}
            optional
            value={field.value}
          />
        )}
      />
      {errors.tenantPhone ? (
        <p className="text-xs text-destructive">{errors.tenantPhone.message}</p>
      ) : null}
    </>
  )
);
TenantContactFields.displayName = "TenantContactFields";
