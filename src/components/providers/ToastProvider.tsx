"use client";

import { Toaster } from "react-hot-toast";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        containerClassName="!z-[60]"
        gutter={12}
        toastOptions={{
          duration: 5000,
          style: {
            background: "var(--color-surface-1)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-dialog)",
            fontSize: "13px",
            padding: "12px 14px",
            maxWidth: "22rem",
          },
          success: {
            iconTheme: {
              primary: "var(--color-accent)",
              secondary: "var(--color-canvas)",
            },
          },
          error: {
            iconTheme: {
              primary: "var(--color-danger)",
              secondary: "var(--color-canvas)",
            },
          },
        }}
      />
    </>
  );
}
