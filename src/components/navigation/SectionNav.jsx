import { navigation } from '../../config/navigation.js';

export default function SectionNav({ activeSection }) {
  return (
    <nav className="section-nav" aria-label="Navegação do convite">
      {navigation.map(({ id, label }, index) => (
        <a
          key={id}
          href={`#${id}`}
          className={activeSection === id ? 'active' : ''}
          aria-label={label}
          aria-current={activeSection === id ? 'location' : undefined}
        >
          <span aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}
