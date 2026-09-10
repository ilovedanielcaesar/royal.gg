import Band from "../../components/Band";
import SignInMethodsCard from "../../components/SignInMethodsCard";

type Props = {
  email: string | null;
};

/**
 * A synthetic `@royal.gg.local` address is not an email and is never shown.
 *
 * The first twelve accounts have no real address: signup invented one from
 * the username so Supabase Auth had something to store (`syntheticEmail()` in
 * `lib/supabase.ts`). It is a lookup key for username login, not a way to
 * reach anybody, and printing it on the page presented an implementation
 * detail as a fact about the user.
 *
 * The row is dropped rather than filled with a placeholder, and the sign-in
 * methods below it — which is where Google linking lives, the only safe route
 * to a real address for these accounts — carry the whole band on their own.
 */
const SYNTHETIC_SUFFIX = "@royal.gg.local";

export default function AccountBand({ email }: Props) {
  const realEmail =
    email && !email.toLowerCase().endsWith(SYNTHETIC_SUFFIX) ? email : null;

  return (
    <Band
      title="Your account"
      caption="How you get into this account. Nothing here is group-specific."
    >
      {realEmail && (
        <dl className="mt-5 border-b border-card-100 pb-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <dt className="text-ink-500">Email</dt>
            <dd className="font-medium text-ink-900">{realEmail}</dd>
          </div>
        </dl>
      )}
      <div className="mt-5">
        <SignInMethodsCard />
      </div>
    </Band>
  );
}
