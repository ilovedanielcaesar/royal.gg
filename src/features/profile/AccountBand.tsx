import Band from "../../components/Band";
import SignInMethodsCard from "../../components/SignInMethodsCard";

type Props = {
  email: string | null;
};

export default function AccountBand({ email }: Props) {
  return (
    <Band
      title="Your account"
      caption="Your identity and the ways you can sign in."
    >
      <dl className="mt-5 border-b border-card-100 pb-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <dt className="text-ink-500">Email</dt>
          <dd className="font-medium text-ink-900">{email ?? "Unavailable"}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <SignInMethodsCard />
      </div>
    </Band>
  );
}
