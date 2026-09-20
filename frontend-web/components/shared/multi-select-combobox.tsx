"use client";

import { useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

// Same Popover(base-ui)+Command(cmdk) pairing artwork-submit-form.tsx's
// painting-style picker already uses — this just adds badges + multi-select
// on top instead of inventing a second combobox stack.
export function MultiSelectCombobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  className,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className={cn(
          "flex min-h-10 w-full items-start justify-between rounded-md border border-input bg-background px-2 py-2 text-sm outline-none transition-colors hover:bg-accent/10 focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 pr-2.5">
          {value.length > 0 ? (
            value.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="gap-1 rounded-md border-border bg-background py-2.5! pl-2.5 pr-1"
              >
                {labelOf(v)}
                <button
                  type="button"
                  className="ml-0 inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(v);
                  }}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronsUpDown className="mt-1 size-4 shrink-0 text-muted-foreground/80" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9 px-1" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={() => toggle(option.value)}
                  className="flex items-center rounded-md pr-2"
                  data-selected={value.includes(option.value)}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
