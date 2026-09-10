"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { PageLoader } from "@/lib/ui/skeleton";

/**
 * Login has been removed - this is now a silent pass-through. Visitors are
 * auto-signed-in as the demo admin (see AutoSignIn in providers.tsx) and land
 * straight on the dashboard. Any stray redirect to /login simply bounces to
 * /dashboard once the session is established.
 */
export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    } else if (status === "unauthenticated") {
      signIn("credentials", {
        redirect: false,
        email: "admin@resolveai.io",
        password: "123456",
      })
        .then(() => router.replace("/dashboard"))
        .catch(() => router.replace("/dashboard"));
    }
  }, [status, router]);

  return <PageLoader label="Loading ResolveAI..." />;
}
