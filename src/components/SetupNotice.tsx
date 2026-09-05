import Card from "./Card";

export default function SetupNotice() {
  return (
    <div className="mx-auto mt-8 max-w-xl">
      <Card watermarkSuit="diamond" rankLabel="!" accent="crimson">
        <div className="p-6">
          <h2 className="font-display text-2xl text-ink-900">
            Supabase isn't configured yet
          </h2>
          <p className="mt-2 text-sm text-ink-700">
            The app needs a Supabase URL and anon key to read and write data.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-700">
            <li>
              Create a free Supabase project at{" "}
              <span className="font-mono">supabase.com</span>.
            </li>
            <li>
              In the dashboard&rsquo;s SQL editor, run every file in{" "}
              <span className="font-mono">supabase/migrations/</span> in
              numeric order. Running only the first one leaves row-level
              security denying every query.
            </li>
            <li>
              Copy <span className="font-mono">.env.example</span> to{" "}
              <span className="font-mono">.env.local</span> and fill in{" "}
              <span className="font-mono">VITE_SUPABASE_URL</span> and{" "}
              <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> from
              Project Settings → API.
            </li>
            <li>Restart the dev server.</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
