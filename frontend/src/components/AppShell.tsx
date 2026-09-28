"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BrainCircuit, History, LayoutDashboard, LogOut, Moon, Salad, ScanLine, ShieldCheck, Sun, UserRound } from "lucide-react";
import { apiFetch, clearToken, getToken } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/scan", label: "New Scan", Icon: ScanLine },
  { href: "/history", label: "Prediction History", Icon: History },
  { href: "/food", label: "Food & Lifestyle", Icon: Salad },
  { href: "/model", label: "Model Information", Icon: BrainCircuit },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

function subscribeToToken(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("neuroview-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("neuroview-auth-change", callback);
  };
}

function getServerToken() {
  return null;
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("neuroview-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("neuroview-theme-change", callback);
  };
}

function getTheme() {
  return localStorage.getItem("neuroview_theme") === "dark" ? "dark" : "light";
}

function getServerTheme() {
  return "light";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);
  const token = useSyncExternalStore(subscribeToToken, getToken, getServerToken);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      return () => { active = false; };
    }

    apiFetch<{ user: { role: string } }>("/auth/me")
      .then(({ user }) => {
        if (active) setRole(user.role);
      })
      .catch(() => {
        if (active) setRole(null);
      });

    return () => { active = false; };
  }, [pathname, token]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isAdminPage = pathname === "/admin";

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    localStorage.setItem("neuroview_theme", nextTheme);
    window.dispatchEvent(new Event("neuroview-theme-change"));
  };

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <Link href={token ? "/dashboard" : "/login"} className="brand" aria-label="NeuroView home">
            <span className="brand-mark"><BrainCircuit size={19} strokeWidth={1.8} /></span>
            <span>NEUROVIEW</span>
          </Link>
        </div>

        <nav className="nav-bar" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "nav-link active" : "nav-link"}
            >
              <item.Icon size={16} strokeWidth={1.9} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          {token && role === "admin" && (
            <Link href="/admin" className={isAdminPage ? "nav-link active" : "nav-link"}>
              <ShieldCheck size={16} strokeWidth={1.9} aria-hidden="true" />
              Admin Dashboard
            </Link>
          )}
        </nav>

        <div className="nav-actions">
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
          </button>
          <button type="button" className="ghost-btn" onClick={handleLogout} aria-label="Logout"><LogOut size={16} /><span>Logout</span></button>
        </div>
      </header>

      <main className="page-layout">{children}</main>
    </div>
  );
}
