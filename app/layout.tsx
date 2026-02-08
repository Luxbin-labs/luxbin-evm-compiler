import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUXBIN EVM Compiler — Write Smart Contracts in LUXBIN",
  description:
    "The first LUXBIN-to-Solidity transpiler. Write smart contracts in LUXBIN Light Language and compile them to EVM-compatible Solidity.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  );
}
