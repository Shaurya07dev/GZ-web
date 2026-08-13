// Shared shape every legal document's content file exports (Terms, Privacy,
// Cookies) so LegalLayout/LegalToc/LegalSectionBlock stay content-agnostic —
// swapping in a fourth legal doc later is a new data file, not new UI.
export interface LegalSection {
  id: string;
  heading: string;
  body: string[];
}
