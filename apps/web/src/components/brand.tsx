import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="OWL, inicio">
      <svg aria-hidden="true" viewBox="0 0 48 44">
        <path d="M5 7L16 12L24 6L32 12L43 7L40 30L24 40L8 30Z" />
        <circle cx="16" cy="22" r="7" />
        <circle cx="32" cy="22" r="7" />
        <circle className="pupil" cx="16" cy="22" r="2" />
        <circle className="pupil" cx="32" cy="22" r="2" />
        <path d="M21 29L24 33L27 29" />
      </svg>
      <span>
        OWL<small>OUR WEALTH LATAM</small>
      </span>
    </Link>
  );
}
