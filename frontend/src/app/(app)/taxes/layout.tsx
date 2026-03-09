import type { Metadata } from "next";

export const metadata: Metadata = { title: "Taxes" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
