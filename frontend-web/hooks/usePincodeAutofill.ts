// Shared pincode-autofill hook. Wraps customerService.lookupPincode (which
// calls GET /v1/pincode/:code — India Post via backend) and populates city +
// state as soon as a valid 6-digit India PIN is typed.
//
// Used by every form that collects (pin, city, state): artist profile pickup
// address, aggregator profile pickup address, customer checkout address,
// collector account address dialog. Keeping the autofill in one hook means
// the UX stays uniform — same latency marker, same "only fills blank
// fields" behaviour, same data source.
//
// Behaviour:
//   * Fires only when `pincode` matches India Post's 6-digit rule AND country
//     is India (or omitted — default is India). Other countries skip the
//     lookup entirely because India Post doesn't know them.
//   * Fills `city` and `state` ONLY when they are currently blank. A buyer
//     who typed their own city shouldn't have it overwritten by the
//     district-name India Post returns (often different from the city name
//     a person uses).
//   * `isFetching` is exposed so the caller can show a small "…" or spinner
//     next to the PIN field.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";

export interface UsePincodeAutofillInput {
  pincode: string;
  country?: string | null;
  city: string;
  state: string;
  onFill: (next: { city?: string; state?: string }) => void;
}

export function usePincodeAutofill(input: UsePincodeAutofillInput) {
  const country = (input.country ?? "IN").toUpperCase();
  const normalised = input.pincode.trim();
  const isIndia = country === "IN";
  const isFullPincode = isIndia && /^[1-9][0-9]{5}$/.test(normalised);

  const query = useQuery({
    queryKey: ["pincode-lookup", normalised],
    queryFn: () => customerService.lookupPincode(normalised),
    enabled: isFullPincode,
    // A pincode never changes for a given 6-digit input, so cache forever
    // within the session. Avoids re-fetching if the user clears + retypes.
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });

  const city = input.city.trim();
  const state = input.state.trim();
  const data = query.data;

  useEffect(() => {
    if (!data) return;
    const next: { city?: string; state?: string } = {};
    if (!city && data.city) next.city = data.city;
    if (!state && data.state) next.state = data.state;
    if (next.city || next.state) input.onFill(next);
    // Intentionally depend only on the fetched values + whether the fields
    // are blank right now. onFill is passed fresh each render by callers
    // using `useForm`'s setValue or a plain setState — listing it would
    // loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.city, data?.state, city === "", state === ""]);

  return {
    isFetching: query.isFetching && isFullPincode,
    serviceable: Boolean(data),
    lookedUp: data ?? null,
  };
}
