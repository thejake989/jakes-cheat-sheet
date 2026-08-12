import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly top projections</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Coming soon — waiting on ingestion + projection engine.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hottest waiver pickups</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Coming soon — waiting on Sleeper trending ingestion.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Drop / add suggestions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Coming soon — waiting on Teams + projection engine.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Injury tracker</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Coming soon — waiting on injury ingestion.</CardContent>
        </Card>
      </div>
    </div>
  );
}
