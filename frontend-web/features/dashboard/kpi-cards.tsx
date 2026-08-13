"use client";

import { motion } from "framer-motion";
import { KPI_METRICS } from "./dashboard-data";

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {KPI_METRICS.map((metric, i) => (
        <motion.div
          key={metric.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
          className="rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {metric.label}
            </span>
            <metric.icon
              className="size-4 text-gold-bright"
              strokeWidth={1.75}
            />
          </div>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-foreground">
            {metric.value}
          </p>
          <p
            className={`mt-2 text-xs ${
              metric.positive ? "text-gold-bright" : "text-muted-foreground"
            }`}
          >
            {metric.delta}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
