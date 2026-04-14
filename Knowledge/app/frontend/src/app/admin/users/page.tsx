"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatusBadge } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { Users, RefreshCw, Shield, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type ManagedUser = {
  email: string;
  role: "citizen" | "operator" | "admin";
  status: "active" | "inactive";
  ministry: string;
};

const KEY = "shahem.admin.users";

const ROLE_OPTIONS: Array<ManagedUser["role"]> = ["citizen", "operator", "admin"];

export default function AdminUsersPage() {
  const { lang } = useApp();
  const isAr = lang === "ar";
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const roleLabel = (role: ManagedUser["role"]) => {
    const map: Record<ManagedUser["role"], string> = {
      citizen: isAr ? "مواطن" : "Citizen",
      operator: isAr ? "مشغل" : "Operator",
      admin: isAr ? "مشرف نظام" : "Admin",
    };
    return map[role];
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [auditRes, casesRes] = await Promise.all([
        fetch("http://localhost:9300/audit?page_size=200"),
        fetch("http://localhost:9400/cases?page_size=200"),
      ]);

      const emails = new Set<string>();
      if (auditRes.ok) {
        const data = await auditRes.json();
        for (const row of data.records || []) {
          if (typeof row.user_id === "string" && row.user_id.includes("@")) emails.add(row.user_id.toLowerCase());
        }
      }

      if (casesRes.ok) {
        const data = await casesRes.json();
        for (const row of data.cases || []) {
          if (typeof row.user_id === "string" && row.user_id.includes("@")) emails.add(row.user_id.toLowerCase());
          if (typeof row.assigned_to === "string" && row.assigned_to.includes("@")) emails.add(row.assigned_to.toLowerCase());
        }
      }

      const discovered = Array.from(emails).map((email) => ({
        email,
        role: "citizen" as ManagedUser["role"],
        status: "active" as ManagedUser["status"],
        ministry: email.split("@")[1] || "government",
      }));

      let stored: ManagedUser[] = [];
      try {
        stored = JSON.parse(window.localStorage.getItem(KEY) || "[]") as ManagedUser[];
      } catch {
        stored = [];
      }

      const mergedMap = new Map<string, ManagedUser>();
      for (const u of discovered) mergedMap.set(u.email, u);
      for (const u of stored) mergedMap.set(u.email, u);
      const merged = Array.from(mergedMap.values()).sort((a, b) => a.email.localeCompare(b.email));
      setUsers(merged);
      window.localStorage.setItem(KEY, JSON.stringify(merged));
    } finally {
      setLoading(false);
    }
  };

  const updateUser = (email: string, patch: Partial<ManagedUser>) => {
    const next = users.map((item) => (item.email === email ? { ...item, ...patch } : item));
    setUsers(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <ProtectedRoute allowed={["admin"]} requireAuth>
    <AppShell title={isAr ? "المستخدمون والأدوار" : "Users & Roles"}>
      <div className="page-container">
        <PageHeader
          title={isAr ? "إدارة المستخدمين والأدوار" : "User & Role Management"}
          subtitle={isAr ? "التحكم في الوصول، تعيين الأدوار، وإدارة الهويات الحكومية." : "Control access, assign roles, and manage government identities."}
          actions={
            <button onClick={loadUsers} className="btn btn-sm btn-secondary">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {isAr ? "تحديث" : "Refresh"}
            </button>
          }
        />

        <div className="surface-card">
          <div className="section-header">
            <div>
              <div className="section-title">{isAr ? "فريق المنصة" : "Platform Team"}</div>
              <div className="section-subtitle">{users.length} {isAr ? "مستخدم" : "users"}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="enhanced-table">
              <thead>
                <tr>
                  <th style={{ textAlign: isAr ? "right" : "left", width: "40%" }}>{isAr ? "الهوية الحكومية" : "Government Identity"}</th>
                  <th style={{ textAlign: isAr ? "right" : "left", width: "25%" }}>{isAr ? "الوزارة" : "Ministry"}</th>
                  <th style={{ textAlign: isAr ? "right" : "left", width: "20%" }}>{isAr ? "الدور" : "Role"}</th>
                  <th style={{ textAlign: isAr ? "right" : "left", width: "15%" }}>{isAr ? "الوصول" : "Access"}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-lg)", background: "linear-gradient(135deg, var(--primary-600), var(--primary-700))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--white)", fontSize: 11, fontWeight: 700 }}>
                          {u.email.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                            <Shield size={13} />
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Building2 size={13} />
                        {u.ministry}
                      </span>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => updateUser(u.email, { role: e.target.value as ManagedUser["role"] })}
                        className="input"
                        style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer" }}
                      >
                        {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() => updateUser(u.email, { status: u.status === "active" ? "inactive" : "active" })}
                        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
                      >
                        <StatusBadge status={u.status} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
