import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";

// The overview's KPI tiles. Also read by AdminShell, which renders the three
// pending counts as live badges on the Moderation nav items — which is why
// every moderation mutation below invalidates ["admin-kpis"]: waiting work has
// to stay visible (and truthful) from anywhere in the console.
export function useAdminKpis() {
  return useQuery({
    queryKey: ["admin-kpis"],
    queryFn: () => adminService.getKpis(),
  });
}

export function useAdminActivity() {
  return useQuery({
    queryKey: ["admin-activity"],
    queryFn: () => adminService.getActivity(),
  });
}
