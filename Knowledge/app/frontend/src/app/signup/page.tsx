"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Globe, KeyRound, ChevronDown, UserRound, Moon, Sun, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
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

export default function SignupPage() {
  const { lang, setLang, setIsLoggedIn, setRole, setUserEmail, themeMode, toggleThemeMode } = useApp();
  const [nameInput, setNameInput] = useState("أحمد الخالدي");
  const [emailInput, setEmailInput] = useState("ahmad.khalidi@moj.gov.jo");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleId>("citizen");
  const [isLoading, setIsLoading] = useState(false);
  const isAr = lang === "ar";
  const router = useRouter();

  const passwordRequirements = {
    length: passwordInput.length >= 8,
    uppercase: /[A-Z]/.test(passwordInput),
    lowercase: /[a-z]/.test(passwordInput),
    number: /[0-9]/.test(passwordInput),
    special: /[^A-Za-z0-9]/.test(passwordInput),
    matches: passwordInput === confirmPassword && confirmPassword !== ""
  };

  useEffect(() => {
    document.body.style.background = themeMode === "dark" ? "#14161A" : "#F4F6FA";
    return () => {
      document.body.style.background = "";
    };
  }, [themeMode]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nameInput.trim()) {
      setError(isAr ? "الرجاء إدخال الاسم الكامل" : "Please enter your full name");
      return;
    }

    if (!emailInput.trim()) {
      setError(isAr ? "الرجاء إدخال البريد الوظيفي" : "Please enter your email address");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailInput)) {
      setError(isAr ? "صيغة البريد الإلكتروني غير صحيحة" : "Invalid email format");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:9400/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput,
          full_name: nameInput,
          role: selectedRole
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
        setError(isAr ? (data.detail === "Email already registered" ? "البريد مسجل مسبقاً" : "فشل إنشاء الحساب") : (data.detail || "Signup failed"));
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
        <h1 className="login-heading">{isAr ? "إنشاء حساب" : "Create account"}</h1>

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

        <form onSubmit={handleSignup} noValidate>
          {/* Honeypot field */}
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
            <label className="field-label">{isAr ? "الاسم الكامل" : "Full name"}</label>
            <div className="input-wrap">
              <input
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setError("");
                }}
                placeholder={isAr ? "الاسم الكامل" : "Full name"}
                className={`login-input ${error && !nameInput.trim() ? "input-error" : ""}`}
              />
              <UserRound size={15} className="field-icon" />
            </div>
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
                className={`login-input ${error && (!passwordInput.trim() || !passwordRequirements.length) ? "input-error" : ""}`}
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
            <label className="field-label">{isAr ? "تأكيد كلمة المرور" : "Confirm password"}</label>
            <div className="input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                placeholder={isAr ? "أعد إدخال كلمة المرور" : "Confirm your password"}
                className={`login-input ${error && !passwordRequirements.matches ? "input-error" : ""}`}
                style={{ paddingInlineEnd: "44px" }}
              />
            </div>
          </div>

          <div className="password-checklist">
            <div className={`check-item ${passwordRequirements.length ? 'met' : ''}`}>
              <div className="dot" />
              <span>{isAr ? "8 أحرف على الأقل" : "At least 8 characters"}</span>
            </div>
            <div className={`check-item ${passwordRequirements.uppercase ? 'met' : ''}`}>
              <div className="dot" />
              <span>{isAr ? "حرف كبير واحد" : "One uppercase letter"}</span>
            </div>
            <div className={`check-item ${passwordRequirements.lowercase ? 'met' : ''}`}>
              <div className="dot" />
              <span>{isAr ? "حرف صغير واحد" : "One lowercase letter"}</span>
            </div>
            <div className={`check-item ${passwordRequirements.number ? 'met' : ''}`}>
              <div className="dot" />
              <span>{isAr ? "رقم واحد على الأقل" : "At least one number"}</span>
            </div>
            <div className={`check-item ${passwordRequirements.special ? 'met' : ''}`}>
              <div className="dot" />
              <span>{isAr ? "رمز خاص واحد" : "One special character"}</span>
            </div>
            <div className={`check-item ${passwordRequirements.matches ? 'met' : ''}`}>
              <div className="dot" />
              <span>{isAr ? "تطابق كلمتي المرور" : "Passwords match"}</span>
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
            {isAr ? "إنشاء الحساب" : "Sign up"}
          </button>
        </form>

        <p className="meta-text">
          {isAr ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
          <Link href="/login" className="accent-link">
            {isAr ? "تسجيل الدخول" : "Log in"}
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
        }

        .login-heading {
          margin: 0 0 22px;
          text-align: center;
          font-size: clamp(34px, 5vw, 40px);
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
          border-radius: 999px;
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
          border-color: rgba(132, 157, 255, 0.92);
          box-shadow: 0 0 0 4px rgba(88, 122, 255, 0.16);
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

        .password-checklist {
          padding: 8px 14px;
          margin: 8px 0 16px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .check-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #748095;
          transition: color 0.2s ease;
        }

        .check-item.met {
          color: #4ade80;
        }

        .check-item .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #334155;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .check-item.met .dot {
          background: #4ade80;
          transform: scale(1.2);
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.3);
        }

        .auth-light .password-checklist {
          background: rgba(0, 0, 0, 0.02);
        }

        .auth-light .check-item {
          color: #64748b;
        }

        .auth-light .check-item.met {
          color: #16a34a;
        }

        .auth-light .check-item .dot {
          background: #cbd5e1;
        }

        .auth-light .check-item.met .dot {
          background: #16a34a;
        }

        .continue-btn {
          width: 100%;
          margin-top: 10px;
          height: 50px;
          border-radius: 999px;
          border: none;
          background: #f3f4f6;
          color: #1a1d23;
          font-size: 20px;
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
        .auth-light .back-home {
          color: #64748b;
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
          border-color: rgba(37, 99, 235, 0.85);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.16);
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
            font-size: clamp(30px, 8vw, 38px);
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
