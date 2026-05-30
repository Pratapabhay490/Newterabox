import type { ApiError } from "@/types";

interface Props {
  message: string;
  code?: ApiError["code"];
}

const HINTS: Record<NonNullable<ApiError["code"]>, string> = {
  INVALID_URL: "Make sure you pasted a TeraBox /s/… share link.",
  NOT_PUBLIC:
    "This share appears to be private, deleted, or password-protected.",
  EXTRACTION_FAILED:
    "TeraBox may have changed its API. Try again, or update the extractor.",
  UPSTREAM_ERROR: "TeraBox didn't respond. Please retry in a few seconds.",
  RATE_LIMITED: "Too many requests — please slow down and try again.",
  UNKNOWN: "Something unexpected went wrong.",
};

export default function ErrorMessage({ message, code }: Props) {
  const hint = code ? HINTS[code] : undefined;
  return (
    <div
      role="alert"
      className="glass mx-auto max-w-2xl rounded-2xl border-red-500/20 bg-red-500/5 px-5 py-4 text-sm"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-500/20 text-red-300">
          !
        </span>
        <div>
          <p className="font-medium text-red-200">{message}</p>
          {hint && <p className="mt-1 text-red-300/70">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
