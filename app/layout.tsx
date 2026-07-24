import type { ReactNode } from "react";

export const metadata = {
  title: "Harga Emas — Daily Gold Price Automation",
  description: "Daily IndoGold vs Logam Mulia gold price comparison, auto-posted to Instagram.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
