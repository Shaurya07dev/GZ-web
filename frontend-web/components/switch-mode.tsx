"use client";

import "@/lib/motion-config";
import { useEffect, useState, type FC } from "react";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

interface SwitchModeProps {
  width?: number;
  height?: number;
  darkColor?: string;
  lightColor?: string;
  knobDarkColor?: string;
  knobLightColor?: string;
  borderDarkColor?: string;
  borderLightColor?: string;
}

export const SwitchMode: FC<SwitchModeProps> = ({
  width = 64,
  height = 32,
  darkColor = "#141209",
  lightColor = "#efead9",
  knobDarkColor = "#28241a",
  knobLightColor = "#fdfbf5",
  borderDarkColor = "#4a4436",
  borderLightColor = "#ddd4bd",
}) => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  if (!mounted) {
    return (
      <div
        style={{ width, height }}
        className="rounded-full border-2 border-transparent"
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const iconSize = height * 0.5;

  return (
    <motion.button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="relative flex items-center rounded-full border-2 transition-colors"
      style={{
        width,
        height,
        borderColor: isDark ? borderDarkColor : borderLightColor,
      }}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{ backgroundColor: isDark ? darkColor : lightColor }}
        transition={{ duration: 0.4 }}
      />

      <motion.div
        layout
        layoutId="switch-mode-knob"
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="absolute rounded-full border-2 z-30"
        style={{
          width: height,
          height,
          right: isDark ? -2 : undefined,
          left: isDark ? undefined : -2,
          backgroundColor: isDark ? knobDarkColor : knobLightColor,
          borderColor: isDark ? borderDarkColor : borderLightColor,
        }}
      />

      <div
        className="relative z-30 flex items-center justify-center"
        style={{ width: height, height }}
      >
        <Sun
          strokeWidth={1.75}
          className={isDark ? "text-muted-foreground/50" : "text-gold"}
          style={{ width: iconSize, height: iconSize }}
        />
      </div>

      <div
        className="relative z-30 flex items-center justify-center"
        style={{ width: height, height }}
      >
        <Moon
          strokeWidth={1.75}
          className={isDark ? "text-gold-bright" : "text-muted-foreground/50"}
          style={{ width: iconSize, height: iconSize }}
        />
      </div>
    </motion.button>
  );
};
