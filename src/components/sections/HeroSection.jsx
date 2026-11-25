import { copy } from '../../config/event.js';
import PoolDecorations from '../layout/PoolDecorations.jsx';
import SectionControls from '../navigation/SectionControls.jsx';
import SectionNav from '../navigation/SectionNav.jsx';

export default function HeroSection({ eventConfig, description }) {
  return (
    <section
      className="page hero"
      id="inicio"
      aria-labelledby="hero-title"
    >
      <PoolDecorations scene="cover" />
      <div className="hero-content invite-cover">
        <img className="hero-logo" src={eventConfig.logo} alt={eventConfig.logoAlt} />
        <h1 className="visually-hidden" id="hero-title">{copy.heroTitle}</h1>
        <p className="visually-hidden">{description}</p>
      </div>
      <SectionControls next={{ id: 'data' }} />
      <SectionNav activeSection="inicio" />
    </section>
  );
}
