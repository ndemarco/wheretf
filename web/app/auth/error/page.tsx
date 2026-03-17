"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have access to this application.",
  Verification: "The verification link has expired or has already been used.",
  Default: "An error occurred during authentication.",
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  const message = errorMessages[error] || errorMessages.Default;

  return (
    <>
      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Authentication Error
        </h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
      </div>

      <div className="mt-8">
        <Link
          href="/auth/signin"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-white bg-accent-500 hover:bg-accent-600 transition-colors"
        >
          Try Again
        </Link>
      </div>

      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        If this problem persists, please contact support.
      </p>
    </>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
