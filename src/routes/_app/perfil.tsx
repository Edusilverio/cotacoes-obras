import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Informações da sua conta
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Edição de perfil em breve.
        </CardContent>
      </Card>
    </div>
  );
}
