import type { Metadata } from "next";
import { LegalLayout } from "@/features/legal/legal-layout";
import { LegalToc } from "@/features/legal/legal-toc";
import { LegalSectionBlock } from "@/features/legal/legal-section";
import {
  cookieCategories,
  cookiesSections,
} from "@/features/legal/data/cookies-sections";

export const metadata: Metadata = {
  title: "Cookie Policy — GalleryZone",
  description: "Which cookies GalleryZone uses and why.",
};

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="August 2026">
      <LegalToc sections={cookiesSections} />
      <article className="flex max-w-3xl flex-1 flex-col gap-10">
        {cookiesSections.map((section) =>
          section.id === "cookie-categories" ? (
            <LegalSectionBlock key={section.id} section={section}>
              <div className="mt-4 overflow-x-auto rounded-lg ring-1 ring-foreground/10">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <th className="px-4 py-3 font-medium text-foreground">Category</th>
                      <th className="px-4 py-3 font-medium text-foreground">Examples</th>
                      <th className="px-4 py-3 font-medium text-foreground">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cookieCategories.map((row) => (
                      <tr key={row.category} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-3 align-top font-medium whitespace-nowrap text-foreground">
                          {row.category}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {row.examples}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {row.purpose}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </LegalSectionBlock>
          ) : (
            <LegalSectionBlock key={section.id} section={section} />
          )
        )}
      </article>
    </LegalLayout>
  );
}
