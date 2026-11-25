export default function SiteHeader({ eventConfig }) {
  return (
    <header className="site-header">
      <a
        className="wordmark"
        href="#inicio"
        aria-label={`${eventConfig.honoree}, início`}
      >
        OM
      </a>
      <span>{eventConfig.title}</span>
    </header>
  );
}
