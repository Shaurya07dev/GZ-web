"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

// Audit §10: the admin dashboards need one-click "Download as Excel" per table.
// This is a shared button that hits `GET /v1/admin/export/<thing>.xlsx` with
// the admin's Firebase ID token in the Authorization header, then triggers a
// browser save-as dialog with the returned Blob.
//
// We can't use a plain `<a href>` because the Firebase ID token lives in
// memory, not in a cookie — so the download has to be a scripted fetch.

interface DownloadExcelButtonProps {
  /** The export path under /v1/admin/export, e.g. "orders.xlsx" or "users.xlsx?role=artist". */
  endpoint: string;
  /** Label on the button. Defaults to "Download Excel". */
  children?: React.ReactNode;
}

export function DownloadExcelButton({ endpoint, children }: DownloadExcelButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const user = firebaseAuth().currentUser;
      if (!user) throw new Error("Sign in again to download");
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/v1/admin/export/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      // Pull the filename out of Content-Disposition so the browser saves it
      // with the server's dated name rather than the random Blob suffix.
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "export.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
      <Download className="size-3.5" strokeWidth={2} />
      {downloading ? "Preparing…" : (children ?? "Download Excel")}
    </Button>
  );
}
