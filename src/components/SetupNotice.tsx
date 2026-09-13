import Band from "./Band";
import PageHeading from "./PageHeading";
import Sheet from "./Sheet";

/**
 * Shown in place of the whole app when the Supabase env vars are missing.
 *
 * It is a full-screen state, so it is shaped like a page: heading on the
 * felt, one sheet. It was a lone `Card` with an `<h2>` inside it, which is
 * the pre-redesign shape and — since this is the very first thing a fresh
 * clone renders — the first impression the app makes.
 */
export default function SetupNotice() {
  return (
    <>
      <PageHeading
        title="Not dealt in yet"
        subtitle="The app needs a Supabase URL and anon key before it can read or write anything."
      />
      <Sheet>
        <Band kicker="Setup" title="Four steps">
          <ol className="mt-4 max-w-[72ch] list-decimal space-y-2 pl-5 text-sm text-ink-700">
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
        </Band>
      </Sheet>
    </>
  );
}
