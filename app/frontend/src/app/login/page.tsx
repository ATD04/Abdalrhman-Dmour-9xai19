"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Globe, KeyRound, ChevronDown, Moon, Sun, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppShell";
import { useRouter } from "next/navigation";
import { setAuthCookie } from "@/lib/auth-cookie";
import { mapLegacyRole } from "@/lib/user-context";

const ROLES = [
  { id: "citizen", label: "Public Citizen", labelAr: "مواطن" },
  { id: "operator", label: "System Operator", labelAr: "مشغل النظام" },
  { id: "admin", label: "System Admin", labelAr: "مسؤول النظام" },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

export default function LoginPage() {
  const { lang, setLang, setIsLoggedIn, setRole, setUserEmail, themeMode, toggleThemeMode } = useApp();
  const [emailInput, setEmailInput] = useState("ahmad.khalidi@moj.gov.jo");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleId>("citizen");
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const isAr = lang === "ar";
  const router = useRouter();

  useEffect(() => {
    document.body.style.background = themeMode === "dark" ? "var(--bg-dark, #0f172a)" : "var(--bg-light, #fafaf9)";
    return () => {
      document.body.style.background = "";
    };
  }, [themeMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Honeypot check for bots
    if (honeypot) {
      console.warn("Honeypot triggered");
      return;
    }

    // Rate limiting simulation
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(isAr 
        ? `محاولات كثيرة جداً. يرجى الانتظار ${remaining} ثانية` 
        : `Too many attempts. Please wait ${remaining} seconds`);
      return;
    }

    if (!emailInput.trim() || !passwordInput.trim()) {
      setError(isAr ? "الرجاء إدخال جميع البيانات المطلوبة" : "Please enter all required fields");
      return;
    }
    
    // Strict email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailInput)) {
      setError(isAr ? "صيغة البريد الإلكتروني غير صحيحة" : "Invalid email format");
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch("http://localhost:9400/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput
        })
      });

      if (response.ok) {
        const user = await response.json();
        const effectiveRole = mapLegacyRole(user.role || selectedRole);
        setIsLoggedIn(true);
        setUserEmail(user.email);
        setRole(effectiveRole);
        setAuthCookie({ email: user.email, role: effectiveRole, isLoggedIn: true });
        router.push("/");
      } else {
        setIsLoading(false);
        const data = await response.json();
        setError(isAr ? (data.detail === "Email already registered" ? "البريد مسجل مسبقاً" : "فشل تسجيل الدخول") : (data.detail || "Login failed"));
        
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          setLockoutUntil(Date.now() + 30000);
        }
      }
    } catch (err) {
      setIsLoading(false);
      setError(isAr ? "فشل الاتصال بخادم المصادقة" : "Failed to connect to authentication server");
    }
  };

  return (
    <div className={`login-root ${themeMode === "dark" ? "auth-dark" : "auth-light"}`} dir={isAr ? "rtl" : "ltr"} style={{ fontFamily: isAr ? "IBM Plex Sans Arabic, sans-serif" : "IBM Plex Sans, sans-serif" }}>
      <div className="login-pattern" />

      <button onClick={() => setLang(isAr ? "en" : "ar")} className="lang-toggle" type="button">
        <Globe size={14} />
        {isAr ? "English" : "العربية"}
      </button>

      <button
        onClick={toggleThemeMode}
        className="theme-toggle"
        type="button"
        aria-label={themeMode === "dark" ? (isAr ? "تبديل إلى الوضع الفاتح" : "Switch to light mode") : (isAr ? "تبديل إلى الوضع الداكن" : "Switch to dark mode")}
        aria-pressed={themeMode === "dark"}
      >
        {themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        {themeMode === "dark" ? (isAr ? "فاتح" : "Light") : (isAr ? "داكن" : "Dark")}
      </button>

      <div className="brand-block" aria-hidden="true">
        <img src="/shahem-logo.png" alt="Shahem logo" className="brand-logo" onError={(e) => { e.currentTarget.src = "/shahem-logo.svg"; }} />
        <div>
          <div className="brand-title">{isAr ? "شهم" : "Shahem"}</div>
          <div className="brand-subtitle">Intelligence Platform</div>
        </div>
      </div>

      <motion.div
        className="login-shell"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <h1 className="login-heading">{isAr ? "مرحبا بعودتك" : "Welcome back"}</h1>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="error-message"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleLogin} noValidate>
          {/* Honeypot field (hidden from users) */}
          <div style={{ position: 'absolute', opacity: 0, zIndex: -1, pointerEvents: 'none' }}>
            <input 
              tabIndex={-1} 
              autoComplete="off" 
              value={honeypot} 
              onChange={(e) => setHoneypot(e.target.value)} 
              placeholder="Leave this empty"
            />
          </div>
          <div className="field-group">
            <label className="field-label">{isAr ? "البريد الوظيفي" : "Email address"}</label>
            <div className="input-wrap">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setError("");
                }}
                placeholder={isAr ? "name@ministry.gov.jo" : "name@ministry.gov.jo"}
                className={`login-input ${error && (!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) ? "input-error" : ""}`}
              />
              <KeyRound size={15} className="field-icon" />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">{isAr ? "كلمة المرور" : "Password"}</label>
            <div className="input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setError("");
                }}
                placeholder={isAr ? "أدخل كلمة المرور" : "Enter your password"}
                className={`login-input ${error && !passwordInput.trim() ? "input-error" : ""}`}
                style={{ paddingInlineEnd: "44px" }}
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? (isAr ? "إخفاء كلمة المرور" : "Hide password") : (isAr ? "إظهار كلمة المرور" : "Show password")}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">{isAr ? "الدور الوظيفي" : "Access role"}</label>
            <div className="select-wrap">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as RoleId)}
                className="login-select"
                aria-label={isAr ? "الدور الوظيفي" : "Access role"}
              >
                {ROLES.map((role) => (
                  <option key={role.id} value={role.id}>
                    {isAr ? role.labelAr : role.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="field-icon" />
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="continue-btn">
            {isLoading ? <span className="spinner" /> : null}
            {isAr ? "متابعة" : "Continue"}
          </button>
        </form>

        <p className="meta-text">
          {isAr ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
          <Link href="/signup" className="accent-link">
            {isAr ? "إنشاء حساب" : "Sign up"}
          </Link>
        </p>

        <div className="legal-links">
          <a href="#" onClick={(e) => e.preventDefault()}>{isAr ? "شروط الاستخدام" : "Terms of Use"}</a>
          <span className="legal-sep">|</span>
          <a href="#" onClick={(e) => e.preventDefault()}>{isAr ? "سياسة الخصوصية" : "Privacy Policy"}</a>
        </div>

        <p className="back-home">
          <Link href="/">{isAr ? "العودة للرئيسية" : "Cancel and Return Home"}</Link>
        </p>
      </motion.div>

      <style jsx global>{`
        .login-root {
          --bg-light: #fafaf9;
          --bg-dark: #0f172a;
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          color: #e5e7eb;
          background:
            radial-gradient(1100px 560px at 14% -12%, rgba(74, 109, 255, 0.2), transparent 58%),
            radial-gradient(940px 520px at 88% 112%, rgba(57, 130, 219, 0.16), transparent 62%),
            linear-gradient(145deg, #1e2025 0%, #17191e 42%, #13151a 100%);
        }

        .login-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(148, 163, 184, 0.11) 0.8px, transparent 0.8px);
          background-size: 18px 18px;
          opacity: 0.4;
          pointer-events: none;
        }

        .lang-toggle {
          position: absolute;
          top: 22px;
          left: 22px;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: rgba(26, 29, 35, 0.66);
          color: #cbd5e1;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease;
          backdrop-filter: blur(8px);
        }

        .lang-toggle:hover {
          color: #f8fafc;
          border-color: rgba(148, 163, 184, 0.5);
        }

        .theme-toggle {
          position: absolute;
          top: 22px;
          left: 124px;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: rgba(26, 29, 35, 0.66);
          color: #cbd5e1;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease;
          backdrop-filter: blur(8px);
        }

        .theme-toggle:hover {
          color: #f8fafc;
          border-color: rgba(148, 163, 184, 0.5);
        }

        .brand-block {
          position: absolute;
          top: 24px;
          right: 24px;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 46px;
          height: 46px;
          object-fit: contain;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(148, 163, 184, 0.38);
          border-radius: 10px;
          padding: 6px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .brand-title {
          font-size: 22px;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.1;
          letter-spacing: -0.01em;
        }

        .brand-subtitle {
          font-size: 12px;
          color: #8d97a8;
          margin-top: 2px;
        }

        .login-shell {
          width: min(100%, 420px);
          position: relative;
          z-index: 1;
          border-radius: 24px;
          box-shadow: 0 4px 6px -2px rgb(15 23 42 / 0.03), 0 12px 24px -4px rgb(15 23 42 / 0.08);
        }

        .login-heading {
          margin: 0 0 22px;
          text-align: center;
          font-size: clamp(36px, 6vw, 42px);
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #f8fafc;
        }

        .field-group {
          margin-bottom: 14px;
        }

        .field-label {
          display: inline-block;
          margin-inline-start: 14px;
          margin-bottom: 6px;
          font-size: 13px;
          color: #7ea2ff;
          font-weight: 500;
        }

        .input-wrap,
        .select-wrap {
          position: relative;
        }

        .login-input,
        .login-select {
          width: 100%;
          height: 48px;
          border-radius: 14px;
          border: 1px solid rgba(88, 122, 255, 0.75);
          background: rgba(23, 25, 30, 0.75);
          color: #e2e8f0;
          font-size: 15px;
          outline: none;
          padding-inline-start: 16px;
          padding-inline-end: 44px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
          backdrop-filter: blur(6px);
        }

        .login-select {
          appearance: none;
          cursor: pointer;
        }

        .login-input::placeholder {
          color: #748095;
        }

        .login-input:focus,
        .login-select:focus {
          border-color: var(--teal-500);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--teal-500) 12%, transparent);
        }

        .field-icon {
          position: absolute;
          inset-inline-end: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #8c95a3;
          pointer-events: none;
        }

        .toggle-password {
          position: absolute;
          inset-inline-end: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #8c95a3;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: color 0.2s ease, background 0.2s ease;
        }

        .toggle-password:hover {
          color: #e2e8f0;
          background: rgba(255, 255, 255, 0.1);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          margin-bottom: 20px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 14px;
        }

        .input-error {
          border-color: rgba(239, 68, 68, 0.5) !important;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1) !important;
        }

        .continue-btn {
          width: 100%;
          margin-top: 10px;
          height: 50px;
          border-radius: 14px;
          border: none;
          background: #f3f4f6;
          color: #1a1d23;
          font-size: 22px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          box-shadow: 0 8px 24px rgba(17, 24, 39, 0.38);
        }

        .continue-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(17, 24, 39, 0.38), 0 0 0 3px color-mix(in srgb, var(--teal-500) 18%, transparent);
        }

        .continue-btn:disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }

        .spinner {
          width: 17px;
          height: 17px;
          border-radius: 999px;
          border: 2px solid #1a1d23;
          border-top-color: transparent;
          animation: spin 0.6s linear infinite;
        }

        .meta-text {
          margin: 16px 0 0;
          text-align: center;
          color: #b6becc;
          font-size: 15px;
        }

        .accent-link {
          color: #8db2ff;
          text-decoration: none;
          font-weight: 500;
        }

        .accent-link:hover {
          color: #b8d2ff;
        }

        .divider-wrap {
          margin: 16px 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .divider-line {
          height: 1px;
          background: rgba(148, 163, 184, 0.32);
          flex: 1;
        }

        .divider-text {
          color: #b7bfcd;
          font-size: 14px;
          letter-spacing: 0.08em;
        }

        .social-btn {
          width: 100%;
          height: 46px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.23);
          background: rgba(17, 20, 26, 0.4);
          color: #d7dee8;
          font-size: 24px;
          font-weight: 400;
          padding: 0 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .social-btn:hover {
          border-color: rgba(148, 163, 184, 0.45);
          background: rgba(21, 24, 30, 0.55);
        }

        .social-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 5px;
          background: #f1d78a;
          color: var(--bg-dark, #0f172a);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .legal-links {
          margin-top: 28px;
          text-align: center;
          color: #a7afbd;
          font-size: 13px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }

        .legal-links a {
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .legal-links a:hover {
          color: #d8deea;
        }

        .legal-sep {
          opacity: 0.7;
        }

        .back-home {
          margin-top: 12px;
          text-align: center;
          font-size: 12px;
          color: #8f98a8;
        }

        .back-home a {
          color: inherit;
          text-decoration: none;
        }

        .back-home a:hover {
          color: #cfd7e3;
        }

        .auth-light {
          color: #1f2937;
          background:
            radial-gradient(1100px 560px at 14% -12%, rgba(56, 99, 219, 0.16), transparent 58%),
            radial-gradient(940px 520px at 88% 112%, rgba(80, 121, 205, 0.12), transparent 62%),
            linear-gradient(145deg, #f8fbff 0%, #f1f5fb 42%, #ebf0f8 100%);
        }

        .auth-light .login-pattern {
          background-image: radial-gradient(rgba(71, 85, 105, 0.12) 0.8px, transparent 0.8px);
          opacity: 0.22;
        }

        .auth-light .lang-toggle,
        .auth-light .theme-toggle {
          border-color: rgba(148, 163, 184, 0.38);
          background: rgba(255, 255, 255, 0.86);
          color: #334155;
        }

        .auth-light .lang-toggle:hover,
        .auth-light .theme-toggle:hover {
          color: #0f172a;
          border-color: rgba(100, 116, 139, 0.65);
        }

        .auth-light .brand-logo {
          background: #ffffff;
        }

        .auth-light .brand-title,
        .auth-light .login-heading {
          color: #0f172a;
        }

        .auth-light .brand-subtitle,
        .auth-light .meta-text,
        .auth-light .legal-links,
        .auth-light .back-home,
        .auth-light .divider-text {
          color: #64748b;
        }

        .auth-light .divider-line {
          background: rgba(100, 116, 139, 0.38);
        }

        .auth-light .field-label {
          color: #1d4ed8;
        }

        .auth-light .login-input,
        .auth-light .login-select {
          border-color: rgba(148, 163, 184, 0.75);
          background: rgba(255, 255, 255, 0.9);
          color: #0f172a;
        }

        .auth-light .login-input::placeholder {
          color: #64748b;
        }

        .auth-light .login-input:focus,
        .auth-light .login-select:focus {
          border-color: var(--teal-500);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--teal-500) 12%, transparent);
        }

        .auth-light .field-icon {
          color: #64748b;
        }

        .auth-light .toggle-password {
          color: #64748b;
        }

        .auth-light .toggle-password:hover {
          color: #0f172a;
          background: rgba(0, 0, 0, 0.05);
        }

        .auth-light .error-message {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.2);
          color: #dc2626;
        }

        .auth-light .continue-btn {
          background: #0f172a;
          color: #f8fafc;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
        }

        .auth-light .continue-btn:hover:not(:disabled) {
          background: #1e293b;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2), 0 0 0 3px color-mix(in srgb, var(--teal-500) 18%, transparent);
        }

        .auth-light .spinner {
          border-color: #f8fafc;
          border-top-color: transparent;
        }

        .auth-light .accent-link,
        .auth-light .legal-links a,
        .auth-light .back-home a {
          color: #1d4ed8;
        }

        .auth-light .accent-link:hover,
        .auth-light .legal-links a:hover,
        .auth-light .back-home a:hover {
          color: #1e40af;
        }

        .auth-light .social-btn {
          border-color: rgba(148, 163, 184, 0.4);
          background: rgba(255, 255, 255, 0.86);
          color: #334155;
        }

        .auth-light .social-btn:hover {
          border-color: rgba(100, 116, 139, 0.52);
          background: rgba(255, 255, 255, 1);
        }

        .auth-light .social-mark {
          background: #e2e8f0;
          color: #0f172a;
        }

        [dir="rtl"] .lang-toggle {
          left: auto;
          right: 22px;
        }

        [dir="rtl"] .theme-toggle {
          left: auto;
          right: 124px;
        }

        [dir="rtl"] .brand-block {
          right: auto;
          left: 24px;
        }

        @media (max-width: 860px) {
          .brand-block {
            position: static;
            margin: 0 auto 18px;
            width: fit-content;
          }

          .lang-toggle,
          [dir="rtl"] .lang-toggle {
            top: 16px;
            right: auto;
            left: 16px;
          }

          .theme-toggle,
          [dir="rtl"] .theme-toggle {
            top: 16px;
            right: auto;
            left: 118px;
          }

          .login-shell {
            margin-top: 56px;
          }

          .login-heading {
            font-size: clamp(32px, 8vw, 40px);
          }

          .continue-btn {
            font-size: 18px;
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
