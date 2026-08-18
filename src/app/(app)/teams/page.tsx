import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateTeamDialog } from "./create-team-dialog";

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, scoring_format, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-wide">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build and track your fantasy rosters.</p>
        </div>
        <CreateTeamDialog />
      </div>

      {!teams?.length ? (
        <Card className="border-dashed border-border/60 bg-transparent">
          <CardContent className="py-14 text-center">
            <p className="text-sm text-muted-foreground">No Teams yet. Create one to start building your roster.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link key={team.id} href={`/teams/${team.id}`} className="group">
              <Card className="relative overflow-hidden border-border/60 transition-all group-hover:border-primary/50 group-hover:shadow-[0_0_0_1px_var(--primary),0_8px_24px_-8px_oklch(0.80_0.15_75/0.25)]">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 transition-opacity group-hover:opacity-100" />
                <CardHeader>
                  <CardTitle className="flex items-center justify-between font-heading text-xl font-semibold tracking-wide">
                    {team.name}
                    <Badge variant="secondary" className="font-body text-xs font-medium">
                      {team.scoring_format === "ppr" ? "PPR" : "Standard"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">View roster and ratings →</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
