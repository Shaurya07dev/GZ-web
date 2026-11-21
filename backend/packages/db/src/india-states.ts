// Indian state + union-territory lookup used by the tax-invoice path.
//
// Rule 46 of the CGST Rules requires the invoice to state the place of
// supply along with the two-digit state/UT code (the "GST state code",
// 01–38) and the state's name. Intra-state supplies split GST into
// CGST + SGST — except when the state is a union territory *without* its
// own legislature, in which case SGST is replaced by UTGST. The UTs
// with legislatures (Delhi, Puducherry, Jammu & Kashmir) keep SGST.
//
// This table is the single source of truth for every invoice-side GST
// decision so the stamp logic and the PDF renderer can't drift.

export interface IndianStateMeta {
  /** Full state/UT name as it appears on addresses. */
  name: string;
  /** Official two-digit GST state code (01–38). */
  numericCode: string;
  /** Two-letter postal abbreviation — "TS", "KA", "DL". */
  code: string;
  /** Union territory without its own legislature → intra-state supplies
   *  use CGST + UTGST (not SGST). SGST states and UTs-with-legislature
   *  are `false`. */
  isUtWithoutLegislature: boolean;
}

/** Keyed by the uppercased full state name so lookups survive stray
 *  whitespace or casing differences in buyer-entered addresses. */
export const INDIAN_STATES: Record<string, IndianStateMeta> = {
  "JAMMU AND KASHMIR":                    { name: "Jammu and Kashmir",                 numericCode: "01", code: "JK", isUtWithoutLegislature: false },
  "HIMACHAL PRADESH":                     { name: "Himachal Pradesh",                   numericCode: "02", code: "HP", isUtWithoutLegislature: false },
  PUNJAB:                                 { name: "Punjab",                             numericCode: "03", code: "PB", isUtWithoutLegislature: false },
  CHANDIGARH:                             { name: "Chandigarh",                         numericCode: "04", code: "CH", isUtWithoutLegislature: true  },
  UTTARAKHAND:                            { name: "Uttarakhand",                        numericCode: "05", code: "UK", isUtWithoutLegislature: false },
  HARYANA:                                { name: "Haryana",                            numericCode: "06", code: "HR", isUtWithoutLegislature: false },
  DELHI:                                  { name: "Delhi",                              numericCode: "07", code: "DL", isUtWithoutLegislature: false },
  RAJASTHAN:                              { name: "Rajasthan",                          numericCode: "08", code: "RJ", isUtWithoutLegislature: false },
  "UTTAR PRADESH":                        { name: "Uttar Pradesh",                      numericCode: "09", code: "UP", isUtWithoutLegislature: false },
  BIHAR:                                  { name: "Bihar",                              numericCode: "10", code: "BR", isUtWithoutLegislature: false },
  SIKKIM:                                 { name: "Sikkim",                             numericCode: "11", code: "SK", isUtWithoutLegislature: false },
  "ARUNACHAL PRADESH":                    { name: "Arunachal Pradesh",                  numericCode: "12", code: "AR", isUtWithoutLegislature: false },
  NAGALAND:                               { name: "Nagaland",                           numericCode: "13", code: "NL", isUtWithoutLegislature: false },
  MANIPUR:                                { name: "Manipur",                            numericCode: "14", code: "MN", isUtWithoutLegislature: false },
  MIZORAM:                                { name: "Mizoram",                            numericCode: "15", code: "MZ", isUtWithoutLegislature: false },
  TRIPURA:                                { name: "Tripura",                            numericCode: "16", code: "TR", isUtWithoutLegislature: false },
  MEGHALAYA:                              { name: "Meghalaya",                          numericCode: "17", code: "ML", isUtWithoutLegislature: false },
  ASSAM:                                  { name: "Assam",                              numericCode: "18", code: "AS", isUtWithoutLegislature: false },
  "WEST BENGAL":                          { name: "West Bengal",                        numericCode: "19", code: "WB", isUtWithoutLegislature: false },
  JHARKHAND:                              { name: "Jharkhand",                          numericCode: "20", code: "JH", isUtWithoutLegislature: false },
  ODISHA:                                 { name: "Odisha",                             numericCode: "21", code: "OD", isUtWithoutLegislature: false },
  CHHATTISGARH:                           { name: "Chhattisgarh",                       numericCode: "22", code: "CG", isUtWithoutLegislature: false },
  "MADHYA PRADESH":                       { name: "Madhya Pradesh",                     numericCode: "23", code: "MP", isUtWithoutLegislature: false },
  GUJARAT:                                { name: "Gujarat",                            numericCode: "24", code: "GJ", isUtWithoutLegislature: false },
  // Daman & Diu merged into DNHDD in 2020; code 25 is retired. Addresses
  // written as "Daman and Diu" should still resolve, so alias below.
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": { name: "Dadra and Nagar Haveli and Daman and Diu", numericCode: "26", code: "DN", isUtWithoutLegislature: true  },
  MAHARASHTRA:                            { name: "Maharashtra",                        numericCode: "27", code: "MH", isUtWithoutLegislature: false },
  KARNATAKA:                              { name: "Karnataka",                          numericCode: "29", code: "KA", isUtWithoutLegislature: false },
  GOA:                                    { name: "Goa",                                numericCode: "30", code: "GA", isUtWithoutLegislature: false },
  LAKSHADWEEP:                            { name: "Lakshadweep",                        numericCode: "31", code: "LD", isUtWithoutLegislature: true  },
  KERALA:                                 { name: "Kerala",                             numericCode: "32", code: "KL", isUtWithoutLegislature: false },
  "TAMIL NADU":                           { name: "Tamil Nadu",                         numericCode: "33", code: "TN", isUtWithoutLegislature: false },
  PUDUCHERRY:                             { name: "Puducherry",                         numericCode: "34", code: "PY", isUtWithoutLegislature: false },
  "ANDAMAN AND NICOBAR ISLANDS":          { name: "Andaman and Nicobar Islands",        numericCode: "35", code: "AN", isUtWithoutLegislature: true  },
  TELANGANA:                              { name: "Telangana",                          numericCode: "36", code: "TS", isUtWithoutLegislature: false },
  "ANDHRA PRADESH":                       { name: "Andhra Pradesh",                     numericCode: "37", code: "AP", isUtWithoutLegislature: false },
  LADAKH:                                 { name: "Ladakh",                             numericCode: "38", code: "LA", isUtWithoutLegislature: true  },
};

/** Common address variants that should still resolve. Lowercase + stripped. */
const ALIASES: Record<string, string> = {
  "daman and diu": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "dadra and nagar haveli": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "andaman and nicobar": "ANDAMAN AND NICOBAR ISLANDS",
  "jammu & kashmir": "JAMMU AND KASHMIR",
  "j&k": "JAMMU AND KASHMIR",
  pondicherry: "PUDUCHERRY",
  orissa: "ODISHA",
};

/** Look up by full state name (case/whitespace-insensitive). Returns null
 *  when the name can't be resolved — callers decide whether to default to
 *  blanks or raise. */
export function findIndianState(name: string | null | undefined): IndianStateMeta | null {
  if (!name) return null;
  const normalized = name.trim().toUpperCase().replace(/\s+/g, " ");
  if (INDIAN_STATES[normalized]) return INDIAN_STATES[normalized]!;
  const aliased = ALIASES[normalized.toLowerCase()];
  if (aliased && INDIAN_STATES[aliased]) return INDIAN_STATES[aliased]!;
  return null;
}
