"use client";

import {
  useAggregatorProfile,
  useAcceptAggregatorMouMutation,
} from "@/hooks/useAggregatorProfile";
import { MouAgreement } from "@/features/mou/mou-agreement";
import { AGGREGATOR_MOU } from "./aggregator-mou-data";

// The aggregator's partner agreement, on the same signing surface the artist
// MOU uses. Signed by the nominated contact person, whose name the signature
// has to match.
export function AggregatorMouAgreement() {
  const { data: profile } = useAggregatorProfile();
  const acceptMutation = useAcceptAggregatorMouMutation();

  if (!profile) {
    return (
      <div className="h-40 animate-pulse rounded-lg border border-border bg-card" />
    );
  }

  return (
    <MouAgreement
      document={AGGREGATOR_MOU}
      signerName={profile.contactPerson}
      acceptance={profile.mouAcceptance}
      onSign={(input) => acceptMutation.mutate(input)}
      isPending={acceptMutation.isPending}
      error={acceptMutation.error}
      isSuccess={acceptMutation.isSuccess}
    />
  );
}
