import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contacts" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
