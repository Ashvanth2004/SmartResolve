"use client";

import { SessionProvider, signIn, useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";

type ThemeCtx = { theme: "light" | "dark"; toggle: () => void };
const ThemeContext = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ra-theme");
    const initial: "light" | "dark" =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("ra-theme", theme);
  }, [theme, ready]);

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider>
        <AutoSignIn />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}

/**
 * Login-free demo mode — silently signs every visitor in as the demo admin so
 * the app opens straight on the dashboard with no login screen.
 */
function AutoSignIn() {
  const { status } = useSession();
  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("credentials", {
        redirect: false,
        email: "admin@resolveai.io",
        password: "123456",
      }).catch(() => {});
    }
  }, [status]);
  return null;
}