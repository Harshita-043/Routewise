import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, LockKeyhole, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { login, signup } from "@/services/api";

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = searchParams.get("redirect") || "/";

  const submit = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      const result = mode === "signup"
        ? await signup(form)
        : await login({ email: form.email, password: form.password });

      localStorage.setItem("routewise-token", result.token);
      localStorage.setItem("routewise-user", JSON.stringify(result.user));
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border/50 p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`h-11 rounded-xl border flex items-center justify-center gap-2 ${mode === "signup" ? "border-primary bg-primary/10" : "border-border/50 bg-muted/30"}`}
          >
            <UserRoundPlus className="w-4 h-4" />
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`h-11 rounded-xl border flex items-center justify-center gap-2 ${mode === "login" ? "border-primary bg-primary/10" : "border-border/50 bg-muted/30"}`}
          >
            <LockKeyhole className="w-4 h-4" />
            Login
          </button>
        </div>

        <div className="space-y-4">
          {mode === "signup" && (
            <>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className="w-full h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" className="w-full h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
            </>
          )}
          <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="w-full h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
          <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Password" className="w-full h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : mode === "signup" ? "Create Account" : "Login"}
          </Button>
        </div>
      </div>
    </div>
  );
}
