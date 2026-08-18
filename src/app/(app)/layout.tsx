import Link from "next/link";
import { Button } from "@/components/ui/button";
import { logout } from "../login/actions";
import { Nav } from "./nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-heading text-lg font-bold text-primary-foreground">
                J
              </span>
              <span className="font-heading text-xl font-semibold tracking-wide">
                Jake&apos;s Cheat Sheet
              </span>
            </Link>
            <Nav />
          </div>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
