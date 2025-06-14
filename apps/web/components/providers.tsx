"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components"
import { scan } from "react-scan";

export function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    scan({
      enabled: true,
    });
  }, []);

  return (
    <AuthKitProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        {children}
      </NextThemesProvider>
    </AuthKitProvider>
  )
}
