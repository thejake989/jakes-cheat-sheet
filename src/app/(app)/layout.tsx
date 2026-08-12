import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logout } from "../login/actions";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/compare", label: "Compare" },
  { href: "/teams", label: "Teams" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              Jake&apos;s Cheat Sheet
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
