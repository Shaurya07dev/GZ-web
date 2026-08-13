"use client";

import { useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  regionalStyles: string[];
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
  regionalStyles: [],
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

  function update<K extends keyof SurveyData>(field: K, value: SurveyData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      toast.success("Thanks, your artist survey is in.");
    }, 1000);
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
              <div className="flex flex-col gap-2.5">
                {REGIONAL_PAINTING_STYLES.map((style) => (
                  <div key={style} className="flex items-center gap-2">
                    <Checkbox
                      id={`style-${style}`}
                      checked={data.regionalStyles.includes(style)}
                      onCheckedChange={() =>
                        update(
                          "regionalStyles",
                          toggle(data.regionalStyles, style),
                        )
                      }
                    />
                    <Label
                      htmlFor={`style-${style}`}
                      className="cursor-pointer font-normal"
                    >
                      {style}
                    </Label>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="style-other"
                    checked={data.regionalStyles.includes("Other")}
                    onCheckedChange={() =>
                      update(
                        "regionalStyles",
                        toggle(data.regionalStyles, "Other"),
                      )
                    }
                  />
                  <Label
                    htmlFor="style-other"
                    className="cursor-pointer font-normal"
                  >
                    Other
                  </Label>
                </div>
              </div>
              {data.regionalStyles.includes("Other") && (
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
