import { AuthLayoutPanel } from "@/features/auth/components/auth-layout-panel";

// Route group, not a URL segment (see plan Global Constraints): this shared
// shell wraps /login, /register, /forgot-password, /reset-password and
// /verify-email without those routes sharing a "/auth" URL prefix. None of
// those five sibling routes carry a dynamic segment, so there is no single
// route string that could correctly parameterize LayoutProps<'/exact-route'>
// for a layout shared across all of them (LayoutProps binds to one route);
// plain `children: React.ReactNode` is the honest typing here, not a
// placeholder pending a future fix.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background lg:flex-row">
      <AuthLayoutPanel />
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16 lg:px-16 lg:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
