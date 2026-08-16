"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { z } from "zod";

const surveySchema = z.object({
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().min(5, "Phone number is too short").max(50),
  country: z.string().max(255).optional(),
  state: z.string().min(1, "State is required").max(255),
  city: z.string().min(1, "City is required").max(255),
  artType: z.string().max(255).optional(),
  artTypeOther: z.string().max(500).optional(),
  paintingMethods: z.array(z.string()).max(20).optional(),
  paintingMethodOther: z.string().max(500).optional(),
  regionalStyle: z.string().max(255).optional(),
  regionalStyleOther: z.string().max(500).optional(),
  monthlyEarnings: z.string().min(1, "Monthly earnings is required").max(255),
  experience: z.string().min(1, "Experience is required").max(255),
  satisfaction: z.number().min(0).max(5).optional(),
});
import {
  ART_TYPES,
  PAINTING_METHODS,
  REGIONAL_PAINTING_STYLES,
} from "./artist-survey-data";

interface SurveyData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  artType: string;
  artTypeOther: string;
  paintingMethods: string[];
  paintingMethodOther: string;
  regionalStyle: string;
  regionalStyleOther: string;
  monthlyEarnings: string;
  experience: string;
  satisfaction: number;
}

const EMPTY_SURVEY: SurveyData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  state: "",
  city: "",
  artType: "",
  artTypeOther: "",
  paintingMethods: [],
  paintingMethodOther: "",
  regionalStyle: "",
  regionalStyleOther: "",
  monthlyEarnings: "",
  experience: "",
  satisfaction: 0,
};

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

// A public, no-login survey (anyone with the link can fill it out — it's
// not tied to a GalleryZone account), so this form is deliberately
// self-contained: no auth hooks, no dashboard shell, no react-hook-form/Zod
// machinery. Required fields are plain HTML `required` — the browser
// handles that validation, no need to hand-roll it.
export function ArtistSurveyForm() {
  const [data, setData] = useState<SurveyData>(EMPTY_SURVEY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openStyleCombo, setOpenStyleCombo] = useState(false);

  function update<K extends keyof SurveyData>(field: K, value: SurveyData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    
    const result = surveySchema.safeParse(data);
    if (!result.success) {
      setIsSubmitting(false);
      toast.error(result.error.issues[0].message);
      return;
    }

    if (!supabase) {
      setIsSubmitting(false);
      toast.error("Survey submission isn't configured yet. Please try again later.");
      return;
    }

    const validData = result.data;

    const { error } = await supabase.from("artist_survey_responses").insert([{
      first_name: validData.firstName || null,
      last_name: validData.lastName || null,
      email: validData.email,
      phone: validData.phone,
      country: validData.country || null,
      state: validData.state,
      city: validData.city,
      art_type: validData.artType || null,
      art_type_other: validData.artTypeOther || null,
      painting_methods: validData.paintingMethods?.length ? validData.paintingMethods : null,
      painting_method_other: validData.paintingMethodOther || null,
      regional_styles: validData.regionalStyle ? [validData.regionalStyle] : null,
      regional_style_other: validData.regionalStyleOther || null,
      monthly_earnings: validData.monthlyEarnings,
      experience: validData.experience,
      satisfaction: validData.satisfaction || null,
    }]);

    setIsSubmitting(false);

    if (error) {
      toast.error("Failed to submit survey: " + error.message);
    } else {
      setSubmitted(true);
      toast.success("Thanks, your artist survey is in.");
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 rounded-2xl border border-border bg-card py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <Check className="size-6 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-2 px-6">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Thanks for filling this in
          </h1>
          <p className="text-balance text-sm leading-relaxed text-muted-foreground">
            Your details now have what our curation team needs to feature your
            work well on GalleryZone.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card"
    >
      <div className="border-b border-border px-8 py-7 sm:px-12">
        <h1 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
          Artist Information and Art Type Survey
        </h1>
      </div>

      <Question>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={data.firstName}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={data.lastName}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </div>
        </div>
      </Question>

      <Question>
        <div className="space-y-2">
          <RequiredLabel htmlFor="email">
            What is your email address?
          </RequiredLabel>
          <Input
            id="email"
            type="email"
            required
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
      </Question>

      <Question>
        <div className="space-y-2">
          <RequiredLabel htmlFor="phone">
            What is your phone number?
          </RequiredLabel>
          <Input
            id="phone"
            type="tel"
            required
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>
      </Question>

      <Question>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="country">What is your country?</Label>
            <Input
              id="country"
              value={data.country}
              onChange={(e) => update("country", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="state">
              What is your state or province?
            </RequiredLabel>
            <Input
              id="state"
              required
              value={data.state}
              onChange={(e) => update("state", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="city">What is your city?</RequiredLabel>
            <Input
              id="city"
              required
              value={data.city}
              onChange={(e) => update("city", e.target.value)}
            />
          </div>
        </div>
      </Question>

      <Question>
        <div className="space-y-3">
          <Label>What type of art do you primarily create?</Label>
          <RadioGroup
            value={data.artType}
            onValueChange={(value) => update("artType", value)}
            className="gap-2.5"
          >
            {ART_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <RadioGroupItem value={type} id={`art-type-${type}`} />
                <Label
                  htmlFor={`art-type-${type}`}
                  className="cursor-pointer font-normal"
                >
                  {type}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {data.artType === "Other" && (
            <Input
              placeholder="Other (please specify)"
              value={data.artTypeOther}
              onChange={(e) => update("artTypeOther", e.target.value)}
            />
          )}
        </div>
      </Question>

      {data.artType === "Painting" && (
        <>
          <Question>
            <div className="space-y-3">
              <Label>What method of painting do you use?</Label>
              <div className="flex flex-col gap-2.5">
                {PAINTING_METHODS.map((method) => (
                  <div key={method} className="flex items-center gap-2">
                    <Checkbox
                      id={`method-${method}`}
                      checked={data.paintingMethods.includes(method)}
                      onCheckedChange={() =>
                        update(
                          "paintingMethods",
                          toggle(data.paintingMethods, method),
                        )
                      }
                    />
                    <Label
                      htmlFor={`method-${method}`}
                      className="cursor-pointer font-normal"
                    >
                      {method}
                    </Label>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="method-other"
                    checked={data.paintingMethods.includes("Other")}
                    onCheckedChange={() =>
                      update(
                        "paintingMethods",
                        toggle(data.paintingMethods, "Other"),
                      )
                    }
                  />
                  <Label
                    htmlFor="method-other"
                    className="cursor-pointer font-normal"
                  >
                    Other
                  </Label>
                </div>
              </div>
              {data.paintingMethods.includes("Other") && (
                <Input
                  placeholder="Other (please specify)"
                  value={data.paintingMethodOther}
                  onChange={(e) =>
                    update("paintingMethodOther", e.target.value)
                  }
                />
              )}
            </div>
          </Question>

          <Question>
            <div className="space-y-3">
              <Label>Type of Painting ?</Label>
              <div className="block">
                <Popover open={openStyleCombo} onOpenChange={setOpenStyleCombo}>
                  <PopoverTrigger
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full max-w-sm justify-between text-left font-normal",
                    )}
                    aria-expanded={openStyleCombo}
                  >
                    <span className="truncate">
                      {data.regionalStyle
                        ? data.regionalStyle
                        : "Select painting style..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] sm:w-[350px] p-0">
                    <Command>
                      <CommandInput placeholder="Search style..." />
                      <CommandList>
                        <CommandEmpty>No style found.</CommandEmpty>
                        <CommandGroup>
                          {[...REGIONAL_PAINTING_STYLES, "Other"].map(
                            (style) => (
                              <CommandItem
                                key={style}
                                value={style}
                                onSelect={(currentValue) => {
                                  update(
                                    "regionalStyle",
                                    currentValue === data.regionalStyle
                                      ? ""
                                      : style, // Use the actual style string, not the lowercase currentValue
                                  );
                                  setOpenStyleCombo(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    data.regionalStyle === style
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {style}
                              </CommandItem>
                            ),
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {data.regionalStyle === "Other" && (
                <Input
                  placeholder="Other (please specify)"
                  value={data.regionalStyleOther}
                  onChange={(e) => update("regionalStyleOther", e.target.value)}
                />
              )}
            </div>
          </Question>
        </>
      )}

      <Question>
        <div className="space-y-2">
          <RequiredLabel htmlFor="monthlyEarnings">
            On average, how much do you earn from your art sales per month?
          </RequiredLabel>
          <Input
            id="monthlyEarnings"
            required
            placeholder="e.g. ₹15,000"
            value={data.monthlyEarnings}
            onChange={(e) => update("monthlyEarnings", e.target.value)}
          />
        </div>
      </Question>

      <Question>
        <div className="space-y-2">
          <RequiredLabel htmlFor="experience">
            How long have you been creating art professionally?
          </RequiredLabel>
          <Input
            id="experience"
            required
            placeholder="e.g. 3 years"
            value={data.experience}
            onChange={(e) => update("experience", e.target.value)}
          />
        </div>
      </Question>

      <Question last>
        <div className="space-y-3">
          <Label>
            How would you rate your overall satisfaction with your current art
            career?
          </Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() =>
                  update("satisfaction", n === data.satisfaction ? 0 : n)
                }
                className="rounded-md p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "size-6",
                    n <= data.satisfaction
                      ? "fill-gold-bright text-gold-bright"
                      : "text-muted-foreground/40",
                  )}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        </div>
      </Question>

      <div className="flex flex-col items-center gap-3 px-8 py-8 sm:px-12">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full max-w-xs"
        >
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Submit
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll never ask for passwords or payment details in this survey.
        </p>
      </div>
    </form>
  );
}

function Question({
  children,
  last = false,
}: {
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn("px-8 py-6 sm:px-12", !last && "border-b border-border")}
    >
      {children}
    </div>
  );
}

function RequiredLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor}>
      <span className="text-destructive">*</span>
      {children}
    </Label>
  );
}
