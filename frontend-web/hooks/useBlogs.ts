import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { blogService } from "@/services/blogService";
import type { BlogStatus, SubmitBlogInput, UpdateBlogInput } from "@/types/blog";

const INVALIDATE_KEYS = [
  ["blogs-public"],
  ["blogs-mine"],
  ["blogs-admin"],
];

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of INVALIDATE_KEYS) queryClient.invalidateQueries({ queryKey: key });
}

export function usePublishedBlogs() {
  return useQuery({
    queryKey: ["blogs-public"],
    queryFn: () => blogService.listPublished(),
  });
}

export function usePublishedBlog(slug: string) {
  return useQuery({
    queryKey: ["blogs-public", slug],
    queryFn: () => blogService.getPublished(slug),
    enabled: Boolean(slug),
  });
}

export function useMyBlogs() {
  return useQuery({
    queryKey: ["blogs-mine"],
    queryFn: () => blogService.listMine(),
  });
}

export function useSubmitBlogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitBlogInput) => blogService.submit(input),
    onError: notify.error("Couldn't submit the post"),
    onSuccess: () => {
      notify.success("Submitted for review", "Our editors will read it and get back to you.");
      invalidate(queryClient);
    },
  });
}

export function useUpdateBlogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blogId, patch }: { blogId: string; patch: UpdateBlogInput }) =>
      blogService.updateMine(blogId, patch),
    onError: notify.error("Couldn't save the changes"),
    onSuccess: () => {
      notify.success("Draft saved");
      invalidate(queryClient);
    },
  });
}

export function useDeleteBlogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blogId: string) => blogService.deleteMine(blogId),
    onError: notify.error("Couldn't delete the draft"),
    onSuccess: () => {
      notify.success("Draft deleted");
      invalidate(queryClient);
    },
  });
}

export function useAdminBlogs(status?: BlogStatus) {
  return useQuery({
    queryKey: ["blogs-admin", status ?? "all"],
    queryFn: () => blogService.listForAdmin(status),
  });
}

export function useAcceptBlogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blogId: string) => blogService.accept(blogId),
    onError: notify.error("Couldn't publish the post"),
    onSuccess: () => {
      notify.success("Published", "The post is live on /blogs now.");
      invalidate(queryClient);
    },
  });
}

export function useRejectBlogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blogId, reason }: { blogId: string; reason: string }) =>
      blogService.reject(blogId, reason),
    onError: notify.error("Couldn't reject the post"),
    onSuccess: () => {
      notify.success("Rejected", "The author will see your reason on their draft.");
      invalidate(queryClient);
    },
  });
}
