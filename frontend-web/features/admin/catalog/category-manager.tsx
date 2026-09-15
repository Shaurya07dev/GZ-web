"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderTree, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import { ConfirmActionDialog } from "@/features/admin/confirm-action-dialog";
import {
  useAdminCategories,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from "@/hooks/useAdminCatalog";
import { useAdminAuditStore } from "@/store/useAdminAuditStore";
import type { Category } from "@/types/admin";

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(60, "Keep it under 60 characters"),
});
type CategoryInput = z.infer<typeof categorySchema>;

function slugPreview(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoryManager() {
  const adminName = useCurrentUser().data?.name ?? "Admin";
  const { data: categories, isPending } = useAdminCategories();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const appendAudit = useAdminAuditStore((s) => s.append);
  const deleteMutation = useDeleteCategoryMutation();

  async function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deleting.id);
      queryClient.setQueryData<Category[]>(["admin-categories"], (prev) =>
        (prev ?? []).filter((c) => c.id !== deleting.id),
      );
      appendAudit({
        adminName: adminName,
        action: "category.deleted",
        entityType: "category",
        entityId: deleting.id,
        entityLabel: deleting.name,
      });
      setDeleting(null);
      toast.success("Category deleted");
    } catch (error) {
      // The service rejects with a real explanation when the category still
      // holds artworks — surface it inline in the dialog rather than as a
      // toast that vanishes before it can be acted on.
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete category.",
      );
    }
  }

  const columns: AdminDataTableColumn<Category>[] = [
    {
      key: "name",
      header: "Category",
      render: (row) => (
        <span className="text-sm font-medium text-foreground">{row.name}</span>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      key: "slug",
      header: "Slug",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.slug}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.slug,
    },
    {
      key: "count",
      header: "Artworks",
      render: (row) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.artworkCount}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.artworkCount,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(row)}
            aria-label={`Edit ${row.name}`}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDeleteError(null);
              setDeleting(row);
            }}
            aria-label={`Delete ${row.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New category
        </Button>
      </div>

      <AdminDataTable
        rows={categories ?? []}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.id}
        searchPlaceholder="Search categories"
        searchValue={(row) => `${row.name} ${row.slug}`}
        pageSize={20}
        emptyTitle="No categories"
        emptyDescription="Add a category to start organising the catalogue."
        emptyIcon={FolderTree}
      />

      <CategoryFormDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        category={null}
      />
      <CategoryFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        category={editing}
      />

      <ConfirmActionDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        title={deleting ? `Delete “${deleting.name}”?` : "Delete category?"}
        description={
          <span className="space-y-3">
            <span className="block">
              Categories are only removable once nothing is filed under them.
            </span>
            {deleteError ? (
              <span className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/[0.06] p-3 text-xs text-foreground">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-destructive" />
                <span>{deleteError}</span>
              </span>
            ) : null}
          </span>
        }
        confirmLabel="Delete"
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  category: Category | null;
}) {
  const adminName = useCurrentUser().data?.name ?? "Admin";
  const queryClient = useQueryClient();
  const appendAudit = useAdminAuditStore((s) => s.append);
  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const { control, handleSubmit, watch, reset } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    values: { name: category?.name ?? "" },
  });

  const nameValue = watch("name") ?? "";

  async function onSubmit(values: CategoryInput) {
    setFormError(null);
    try {
      if (mode === "create") {
        const created = await createMutation.mutateAsync(values.name);
        queryClient.setQueryData<Category[]>(["admin-categories"], (prev) => [
          ...(prev ?? []),
          created,
        ]);
        appendAudit({
          adminName: adminName,
          action: "category.created",
          entityType: "category",
          entityId: created.id,
          entityLabel: created.name,
        });
        toast.success("Category created");
      } else if (category) {
        const updated = await updateMutation.mutateAsync({
          categoryId: category.id,
          name: values.name,
        });
        queryClient.setQueryData<Category[]>(["admin-categories"], (prev) =>
          (prev ?? []).map((c) => (c.id === category.id ? updated : c)),
        );
        appendAudit({
          adminName: adminName,
          action: "category.updated",
          entityType: "category",
          entityId: updated.id,
          entityLabel: updated.name,
        });
        toast.success("Category updated");
      }
      reset({ name: "" });
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New category" : "Edit category"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="category-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="category-name"
                  placeholder="e.g. Printmaking"
                  autoComplete="off"
                  disabled={isPending}
                />
                <FieldDescription>
                  Slug:{" "}
                  <span className="font-mono">
                    {slugPreview(nameValue) || "Not set"}
                  </span>
                </FieldDescription>
                <FieldError
                  errors={fieldState.error ? [fieldState.error] : undefined}
                />
              </Field>
            )}
          />

          {formError ? (
            <p className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/[0.06] p-3 text-xs text-foreground">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-destructive" />
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
