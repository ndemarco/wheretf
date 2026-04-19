import { signIn } from "@/lib/auth/config";

// Minimal stub — Phase D will replace this with a proper UI.
// Email+password hits the credentials provider; the dev-impersonate
// form is only rendered in non-production and trusts any email.

async function credentialsSignIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  await signIn("credentials", { email, password, redirectTo: "/" });
}

async function devImpersonate(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  await signIn("dev-impersonate", { email, redirectTo: "/" });
}

export default function LoginPage() {
  const isProd = process.env.NODE_ENV === "production";

  return (
    <div className="max-w-md mx-auto mt-16 p-6">
      <h1 className="text-2xl font-bold mb-6">Sign in</h1>

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

      {!isProd && (
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
