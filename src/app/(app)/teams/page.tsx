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
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Teams</h1>
          <p className="text-sm text-muted-foreground">Build and track your fantasy rosters.</p>
        </div>
        <CreateTeamDialog />
      </div>

      {!teams?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No Teams yet. Create one to start building your roster.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <Card className="transition-colors hover:border-foreground/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {team.name}
                    <Badge variant="secondary">{team.scoring_format === "ppr" ? "PPR" : "Standard"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">View roster and ratings</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
