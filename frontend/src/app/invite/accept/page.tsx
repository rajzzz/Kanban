"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { workspaceApi } from "@/lib/api-client";
import { AxiosError } from "axios";
import Link from "next/link";

// ── Kanban logo icon ─────────────────────────────────────────
function KanbanIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
    >
      <rect width="44" height="44" rx="12" fill="url(#logo-grad)" />
      <rect x="8" y="12" width="8" height="20" rx="2" fill="white" opacity="0.9" />
      <rect x="18" y="8" width="8" height="24" rx="2" fill="white" opacity="0.75" />
      <rect x="28" y="14" width="8" height="16" rx="2" fill="white" opacity="0.6" />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="44" y2="44">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(() => {
    return token ? "loading" : "error";
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    return token ? null : "No invite token found in the URL. Please verify the link you clicked.";
  });
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    async function redeemInvite() {
      try {
        await workspaceApi.acceptInvite(token as string);
        
        if (!isMounted) return;
        setStatus("success");
        
        // Start countdown to redirect
        timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (timer) clearInterval(timer);
              router.push("/dashboard");
              router.refresh();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } catch (err) {
        if (!isMounted) return;
        const axiosErr = err as AxiosError<{ message: string | string[] }>;
        const raw = axiosErr.response?.data?.message;
        const message = Array.isArray(raw) ? raw[0] : raw;
        
        // If they are already a member, count it as a success/redirect opportunity
        if (message?.includes("already a member")) {
          setStatus("success");
          
          timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                if (timer) clearInterval(timer);
                router.push("/dashboard");
                router.refresh();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          return;
        }

        setStatus("error");
        setErrorMessage(message ?? "Failed to accept the invitation. The link may have expired or is invalid.");
      }
    }

    redeemInvite();

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, [token, router]);

  const handleManualGo = () => {
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <>
      {/* Background orbs */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div style={{
          position: "absolute",
          top: "-10%",
          right: "-5%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "-10%",
          left: "-5%",
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
      </div>

      <main
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          className="glass-card animate-fade-up"
          style={{
            width: "100%",
            maxWidth: "440px",
            borderRadius: "1.25rem",
            padding: "2.5rem 2rem",
            boxShadow:
              "0 0 0 1px rgba(99,102,241,0.15), 0 25px 50px rgba(0,0,0,0.5)",
            textAlign: "center",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
            <KanbanIcon />
          </div>

          {status === "loading" && (
            <div>
              <h1
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "1rem",
                }}
              >
                Joining Workspace
              </h1>
              <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "0.9375rem" }}>
                Verifying your invitation token and adding you to the team...
              </p>
              <div style={{ display: "flex", justifyContent: "center", padding: "1rem 0" }}>
                <span className="spinner" style={{ width: "2rem", height: "2rem", borderWidth: "3px" }} aria-hidden="true" />
              </div>
            </div>
          )}

          {status === "success" && (
            <div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    background: "rgba(52, 211, 153, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--success-500)",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <h1
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "1rem",
                }}
              >
                Welcome to the Workspace!
              </h1>
              <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "0.9375rem" }}>
                Your invitation has been accepted successfully. Redirecting you to the dashboard in {countdown}s...
              </p>
              <button
                onClick={handleManualGo}
                className="btn-primary"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {status === "error" && (
            <div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
                <div
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    background: "rgba(248, 113, 113, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--error-500)",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              </div>
              <h1
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "1rem",
                }}
              >
                Invitation Failed
              </h1>
              <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "0.9375rem" }}>
                {errorMessage}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Link
                  href="/login"
                  className="btn-primary"
                  style={{ textDecoration: "none" }}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.875rem",
                    textDecoration: "none",
                    fontWeight: 500,
                    transition: "color 0.15s",
                    padding: "0.5rem",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")}
                >
                  Create an account instead
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div className="spinner" aria-hidden="true" />
        </main>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
