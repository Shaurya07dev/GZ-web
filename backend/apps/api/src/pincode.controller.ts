// India Post pincode → district/state lookup, proxied through our API so
// the mobile app and the website can call a single, cacheable endpoint
// instead of embedding the upstream URL. The upstream is
// https://api.postalpincode.in — a free, public, read-only service.
//
// Added 9 Nov 2026 for the address form autofill: the user enters a
// 6-digit pincode and city + state populate themselves, instead of being
// typed by hand (where a typo silently breaks shipping serviceability
// queries later).

import { Controller, Get, Header, NotFoundException, Param } from "@nestjs/common";
import { Public } from "./auth/roles.decorator.ts";

interface PostOffice {
  Name: string;
  District: string;
  State: string;
}

interface PincodeApiResponse {
  Status: "Success" | "Error" | "404";
  Message: string;
  PostOffice: PostOffice[] | null;
}

@Controller("v1/pincode")
export class PincodeController {
  /**
   * Returns `{ pincode, city, state }` for a serviceable 6-digit pincode.
   * 404 for unknown / non-serviceable. Cache-Control is 1 day — a pincode
   * mapping does not change on the day scale.
   */
  @Public()
  @Get(":pincode")
  @Header("Cache-Control", "public, max-age=86400, s-maxage=86400")
  async lookup(@Param("pincode") pincode: string) {
    if (!/^\d{6}$/.test(pincode)) {
      throw new NotFoundException({ type: "about:blank", title: "Not a 6-digit pincode", status: 404, code: "bad_pincode" });
    }
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    if (!res.ok) {
      throw new NotFoundException({ type: "about:blank", title: "Pincode lookup is temporarily unavailable", status: 404, code: "upstream_unavailable" });
    }
    const body = (await res.json()) as PincodeApiResponse[];
    const first = body[0];
    if (!first || first.Status !== "Success" || !first.PostOffice?.length) {
      throw new NotFoundException({ type: "about:blank", title: "Pincode not recognised", status: 404, code: "not_found" });
    }
    // Multiple post offices can share a pincode (a locality + its neighbours);
    // the district and state are the same across them, so the first row
    // is authoritative for what the form needs.
    const po = first.PostOffice[0]!;
    return { pincode, city: po.District, state: po.State };
  }
}
