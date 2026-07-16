import cron, { type ScheduledTask } from "node-cron";

import { TENANT_RENT_PAYMENT_RECONCILE_CRON_SCHEDULE } from "@/lib/tenant-rent-payment-config";
import { reconcileTenantRentPayments } from "@/services/tenant-rent-payment-reconcile-service";
import { WinstonLogger } from "@/services/winston";

let task: ScheduledTask | null = null;

export function startTenantRentPaymentReconcileCron(): void {
  if (process.env["NODE_ENV"] !== "production") {
    return;
  }

  task = cron.schedule(TENANT_RENT_PAYMENT_RECONCILE_CRON_SCHEDULE, async () => {
    try {
      await reconcileTenantRentPayments();
    } catch (err) {
      WinstonLogger.error({
        err:
          err instanceof Error ? { message: err.message, name: err.name, stack: err.stack } : err,
        msg: "tenant_payments.reconcile_cron_failed",
      });
      console.error("[TenantRentPaymentReconcileCron] Error:", err);
    }
  });
}

export function stopTenantRentPaymentReconcileCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
