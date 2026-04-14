"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield, BookOpen, MessagesSquare, Users, BarChart3,
  Star, CheckCircle, Globe, Lock, Zap, Award, Building2,
  ArrowRight
} from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

export default function LandingPage() {
  const pillars = [
    {
      icon: BookOpen,
      title: "Verified Knowledge Base",
      text: "Policy, law, and sector references from official sources with structured retrieval.",
    },
    {
      icon: MessagesSquare,
      title: "Conversation Intelligence",
      text: "Context-aware answers with citations, confidence signals, and escalation pathways.",
    },
    {
      icon: Users,
      title: "Expert-Governed Workflow",
      text: "Cases are reviewed and approved by experts for institutional-quality outcomes.",
    },
  ];

  return (
    <div style={{ background: "var(--bg-subtle)", color: "var(--text-primary)", minHeight: "100vh" }}>
      <section style={{ background: "linear-gradient(160deg, var(--primary-900) 0%, var(--primary-800) 55%, var(--primary-700) 100%)", position: "relative", overflow: "hidden", padding: "92px 32px 104px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(color-mix(in srgb, var(--accent-gold) 6%, transparent) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
            <motion.div variants={fadeUp} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "color-mix(in srgb, var(--accent-gold) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-gold) 25%, transparent)", borderRadius: 99, padding: "5px 14px", marginBottom: 28 }}>
              <Star size={12} style={{ color: "var(--accent-gold)" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-gold)" }}>Shahem Knowledge Platform</span>
            </motion.div>
            <motion.h1 variants={fadeUp} style={{ fontSize: "clamp(34px, 5vw, 62px)", fontWeight: 800, color: "var(--text-inverse)", marginBottom: 20, maxWidth: 920, lineHeight: 1.05 }}>
              National Policy Intelligence,
              <span style={{ display: "block", background: "linear-gradient(135deg, var(--accent-gold), var(--accent-gold-light))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Built for Public-Sector Decisions
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} style={{ color: "color-mix(in srgb, var(--text-inverse) 85%, transparent)", maxWidth: 760, fontSize: 17, lineHeight: 1.75, marginBottom: 26 }}>
              This page is preserved as a showcase of the platform direction. The operational workspace is the main chatbot interface with role-based capabilities.
            </motion.p>
            <motion.div variants={fadeUp} style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 14, background: "var(--accent-gold)", color: "var(--primary-800)", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 20px color-mix(in srgb, var(--accent-gold) 30%, transparent)" }}>
                Open AI Chatbot
                <ArrowRight size={15} />
              </Link>
              <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 14, border: "1px solid color-mix(in srgb, var(--text-inverse) 25%, transparent)", background: "color-mix(in srgb, var(--text-inverse) 8%, transparent)", color: "var(--text-inverse)", fontWeight: 600, textDecoration: "none" }}>
                Sign In
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section style={{ maxWidth: 1240, margin: "-54px auto 0", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
          {pillars.map((pillar, idx) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.06 }}
              style={{ background: "rgba(255,255,255,0.94)", border: "1px solid color-mix(in srgb, var(--primary-900) 7%, transparent)", borderRadius: 20, padding: "18px 18px 16px", boxShadow: "0 8px 30px color-mix(in srgb, var(--primary-800) 8%, transparent)", backdropFilter: "blur(8px)" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 14, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--primary-700) 8%, transparent)", marginBottom: 10 }}>
                <pillar.icon size={16} color="var(--primary-700)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{pillar.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{pillar.text}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1240, margin: "28px auto 0", padding: "0 24px 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[{ icon: Shield, label: "Governance-by-design" }, { icon: Lock, label: "Audit-ready workflows" }, { icon: Globe, label: "Arabic-first policy context" }, { icon: Zap, label: "Fast, source-grounded responses" }, { icon: Award, label: "Expert quality assurance" }, { icon: Building2, label: "Ministry-level insights" }, { icon: BarChart3, label: "Executive analytics" }, { icon: CheckCircle, label: "Case resolution traceability" }].map((item) => (
            <div key={item.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <item.icon size={15} color="var(--primary-700)" />
              <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 600 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
