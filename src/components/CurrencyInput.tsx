import type { InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

export default function CurrencyInput({
  value,
  onChange,
  className = "",
  placeholder = "0.00",
  ...rest
}: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-display text-sm text-ink-500">
        $
      </span>
      <input
        {...rest}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "tabular w-full rounded-md bg-card-50 pl-6 pr-2 py-1.5 text-right text-sm text-ink-900 ring-1 ring-card-200",
          className,
        ].join(" ")}
      />
    </div>
  );
}
