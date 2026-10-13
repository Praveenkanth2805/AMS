"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Api, ApiError } from "@/lib/api";

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  // If already authenticated, skip the login page entirely
  useEffect(() => {
    Api.me()
      .then(() => {
        setRedirecting(true);
        window.location.href = "/dashboard";
      })
      .catch(() => {
        /* not logged in — fine, stay */
      });
  }, []);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await Api.login(values.email, values.password);
      setRedirecting(true);
      // Full navigation so:
      //  - Set-Cookie is applied before the next request
      //  - Server layout on /dashboard sees the cookie
      //  - No stale RSC cache
      window.location.href = "/dashboard";
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isRateLimited)
          setServerError("Too many attempts. Please wait a minute.");
        else if (err.code === "NETWORK_ERROR")
          setServerError("Network unavailable. Check your connection.");
        else setServerError("Invalid credentials.");
      } else {
        setServerError("Unexpected error.");
      }
    }
  }

  // Full-screen spinner while we redirect
  if (redirecting) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin text-green-700" size={36} />
          <span className="text-sm">Signing you in…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-xl border border-green-100 shadow-sm p-6 space-y-4"
        noValidate
      >
        <h1 className="text-2xl font-semibold text-green-800">Attendance</h1>
        <p className="text-sm text-gray-500">Sign in to continue</p>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
            className="w-full rounded-md border border-gray-300 px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...register("password")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10
                         focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div role="alert"
               className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md
                     bg-green-700 px-4 py-2 text-white font-medium
                     hover:bg-green-800 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={18} />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}