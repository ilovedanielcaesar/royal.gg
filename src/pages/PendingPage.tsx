import Button from "../components/Button";
import Card from "../components/Card";
import { signOut, useCurrentUser } from "../lib/auth";

export default function PendingPage() {
  const { player } = useCurrentUser();
  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6" accent="gold">
        <h1 className="font-display text-2xl text-ink-900">
          Waiting for approval
        </h1>
        <p className="mt-2 text-sm text-ink-700">
          Hi {player?.display_name ?? "there"} — the host needs to approve
          your account before you can see the table. You'll be able to sign in
          right after.
        </p>
        <div className="mt-5">
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
