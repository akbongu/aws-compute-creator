"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertCircle, Key, Loader2 } from "lucide-react";
import styles from "./page.module.css";

export default function Login() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const router = useRouter();

  // Check if server password environment variable is missing
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        
        if (res.status === 500) {
          const data = await res.json();
          if (data.error && data.error.includes("DASHBOARD_PASSWORD")) {
            setSetupRequired(true);
          }
        }
      } catch (err) {
        console.error("Failed to check auth configuration status:", err);
      }
    };
    checkSetupStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || setupRequired) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Redirect to dashboard
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Incorrect password. Please try again.");
      }
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.viewport}>
      <div className={styles.loginCard}>
        
        {/* Header Title & Branding */}
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <Shield size={24} />
          </div>
          <h1>Access Console</h1>
          <p>Please authenticate to access the AWS EC2 dashboard</p>
        </div>

        {/* Form and Status alerts */}
        <form onSubmit={handleSubmit} className={styles.form}>
          
          {setupRequired ? (
            <div className={`${styles.alert} ${styles.alertWarning}`}>
              <AlertCircle size={18} className={styles.alertIcon} />
              <div>
                <strong>Setup Required</strong>
                <p style={{ marginTop: "0.25rem", color: "var(--color-text-secondary)" }}>
                  The environment variable <code>DASHBOARD_PASSWORD</code> is not set in Vercel or your local environment.
                </p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className={`${styles.alert} ${styles.alertError}`}>
                  <AlertCircle size={18} className={styles.alertIcon} />
                  <div>
                    <strong>Access Denied</strong>
                    <p style={{ marginTop: "0.25rem", color: "rgba(253, 164, 175, 0.9)" }}>
                      {error}
                    </p>
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="password-field">Console Password</label>
                <input
                  id="password-field"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button 
                type="submit" 
                className={styles.button}
                disabled={loading || !password}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1.5s linear infinite" }} />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    Unlock Dashboard
                  </>
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
