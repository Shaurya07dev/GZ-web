"use client";

import { Switch } from "@/components/ui/switch";
import {
  useAggregatorSettings,
  useUpdateAggregatorSettingsMutation,
} from "@/hooks/useAggregatorSettings";

const NOTIFICATION_TOGGLES = [
  { key: "notifyNewAssignment" as const, label: "New artwork assigned or reserved" },
  { key: "notifySaleRecorded" as const, label: "Sale recorded" },
  { key: "notifySettlementProcessed" as const, label: "Settlement processed" },
  {
    key: "notifyExpiryReminder" as const,
    label: "30-day display window expiring soon",
  },
];

export function AggregatorSettingsView() {
  const { data: settings } = useAggregatorSettings();
  const updateMutation = useUpdateAggregatorSettingsMutation();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold text-foreground">
          Notifications
        </h2>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {NOTIFICATION_TOGGLES.map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm text-foreground">{toggle.label}</span>
              <Switch
                checked={settings?.[toggle.key] ?? false}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ [toggle.key]: checked })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
