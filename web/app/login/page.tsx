import { signIn } from "@/lib/auth/config";

// Force dynamic rendering so process.env is read at request time,
// not baked in at build time (needed for runtime-injected container env vars).
export const dynamic = "force-dynamic";

async function credentialsSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  await signIn("credentials", { email, password, redirectTo: "/" });
}

async function homelabSignIn() {
  "use server";
  await signIn("homelab", { redirectTo: "/" });
}

async function devImpersonate(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  await signIn("dev-impersonate", { email, redirectTo: "/" });
}

export default function LoginPage() {
  const allowDevImpersonate =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEV_IMPERSONATE === "1";

  const homelabConfigured = !!(
    process.env.AUTH_HOMELAB_ISSUER &&
    process.env.AUTH_HOMELAB_CLIENT_ID &&
    process.env.AUTH_HOMELAB_CLIENT_SECRET
  );

  return (
    <div className="max-w-md mx-auto mt-16 p-6">
      <h1 className="text-2xl font-bold mb-6">Sign in</h1>

      {homelabConfigured && (
        <form action={homelabSignIn} className="mb-6">
          <button
            type="submit"
            className="w-full border border-accent text-accent rounded px-4 py-2 font-medium hover:bg-accent hover:text-white transition-colors"
          >
            Sign in with Homelab IdP
          </button>
        </form>
      )}

      <form action={credentialsSignIn} className="space-y-3 mb-10">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          className="w-full border rounded px-3 py-2 bg-transparent"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          autoComplete="current-password"
          className="w-full border rounded px-3 py-2 bg-transparent"
        />
        <button
          type="submit"
          className="w-full bg-accent text-white rounded px-4 py-2 font-medium"
        >
          Sign in
        </button>
      </form>

      {allowDevImpersonate && (
        <form action={devImpersonate} className="space-y-3 pt-6 border-t">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Dev impersonate (non-prod only)
          </p>
          <input
            name="email"
            type="email"
            required
            placeholder="any@email.example"
            className="w-full border rounded px-3 py-2 bg-transparent"
          />
          <button
            type="submit"
            className="w-full bg-neutral-200 dark:bg-neutral-800 rounded px-4 py-2 font-medium"
          >
            Impersonate
          </button>
        </form>
      )}
    </div>
  );
}
