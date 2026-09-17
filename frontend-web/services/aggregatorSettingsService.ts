// Notification preferences for the aggregator portal — per-browser until a
// preferences route exists; defaults are all-on, matching what the emails
// do today.
export interface AggregatorSettings {
  notifyNewAssignment: boolean;
  notifySaleRecorded: boolean;
  notifySettlementProcessed: boolean;
  notifyExpiryReminder: boolean;
}

const KEY = "gz.aggregator.settings";
const DEFAULTS: AggregatorSettings = { notifyNewAssignment: true, notifySaleRecorded: true, notifySettlementProcessed: true, notifyExpiryReminder: true };

function read(): AggregatorSettings {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AggregatorSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export const aggregatorSettingsService = {
  getSettings: async (): Promise<AggregatorSettings> => read(),

  updateSettings: async (patch: Partial<AggregatorSettings>): Promise<AggregatorSettings> => {
    const next = { ...read(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    return next;
  },
};
