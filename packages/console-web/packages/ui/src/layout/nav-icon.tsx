import type { NavIconKey } from "./types";

export function NavIcon({ icon }: { icon: NavIconKey }) {
  switch (icon) {
    case "grid":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
        </svg>
      );
    case "layers":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 3 8l9 5 9-5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      );
    case "key":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7a5 5 0 1 1-9.58 2H3v4h4v3h3v-3h2.42A5 5 0 0 1 21 7z" />
        </svg>
      );
    case "shield":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 5v6c0 5 3.4 9.4 8 10.8 4.6-1.4 8-5.8 8-10.8V5z" />
        </svg>
      );
    case "link":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.6 13.4a4 4 0 0 0 0 5.6l1.4 1.4a4 4 0 0 0 5.6-5.6l-1-1M13.4 10.6a4 4 0 0 0 0-5.6L12 3.6a4 4 0 1 0-5.6 5.6l1 1" />
          <path d="M8 16 16 8" />
        </svg>
      );
    default:
      return null;
  }
}
