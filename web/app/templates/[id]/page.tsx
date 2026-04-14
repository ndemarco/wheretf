"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Master-detail lives at /templates?selected=<id>.
// Deep links to /templates/<id> redirect to preserve existing bookmarks.
export default function TemplateDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/templates?selected=${id}`);
    }
  }, [id, router]);

  return (
    <div className="flex-1 flex items-center justify-center text-slate-500">
      Redirecting…
    </div>
  );
}
