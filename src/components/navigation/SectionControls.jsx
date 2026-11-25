export default function SectionControls({ previous, next }) {
  return (
    <nav className={`section-controls ${!previous || !next ? 'single-control' : ''}`} aria-label="Navegação das páginas">
      {previous && (
        <a className="page-button page-button-back" href={`#${previous.id}`}>
          <span aria-hidden="true">‹</span> {previous.label || 'Voltar'}
        </a>
      )}
      {next && (
        <a className="page-button page-button-next" href={`#${next.id}`}>
          Próxima página <span aria-hidden="true">›</span>
        </a>
      )}
    </nav>
  );
}
