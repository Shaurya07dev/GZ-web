import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BlogPublicDetail } from "@/features/blogs/blog-public-detail";

export default function BlogDetailPage(props: PageProps<"/blogs/[slug]">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <BlogPublicDetail slugPromise={props.params.then((p) => p.slug)} />
      </main>
      <SiteFooter />
    </>
  );
}
