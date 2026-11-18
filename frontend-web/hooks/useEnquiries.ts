import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { enquiryService, type EnquiryStatus, type EnquiryType } from "@/services/enquiryService";

export function useSubmitEnquiryMutation() {
  return useMutation({ mutationFn: enquiryService.submit });
}

export function useAdminEnquiries(filter: { type: EnquiryType | null; status: EnquiryStatus | null }) {
  return useQuery({ queryKey: ["admin-enquiries", filter.type, filter.status], queryFn: () => enquiryService.list(filter) });
}

export function useSetEnquiryStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnquiryStatus }) => enquiryService.setStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-enquiries"] }),
    onError: notify.error("Couldn't update the message"),
  });
}
