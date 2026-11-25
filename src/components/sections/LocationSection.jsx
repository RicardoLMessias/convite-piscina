import { copy } from '../../config/event.js';
import PoolDecorations from '../layout/PoolDecorations.jsx';
import SectionControls from '../navigation/SectionControls.jsx';
import SectionNav from '../navigation/SectionNav.jsx';

export default function LocationSection({ eventConfig }) {
  return (
    <section
      className="page location"
      id="local"
      aria-labelledby="location-title"
    >
      <PoolDecorations scene="location" />
      <div className="section-inner info-layout">
        <article className="info-card location-card program-card">
          <span className="tag tag-pink" id="location-title">{copy.locationTitle}</span>
          <Divider />
          <ol className="program-list">
            {(eventConfig.program || []).map(({ time, activity }) => (
              <li key={`${time}-${activity}`}>
                <strong>{time}</strong>
                <span>{activity}</span>
              </li>
            ))}
          </ol>
          <Divider />
          <div className="program-notes">
            <p className="program-swimwear-note">Leve sua roupa de banho.</p>
            <p className="program-drinks-note">Leve seu cooler, bebida liberada.</p>
            <p className="program-address-note">O endereço será liberado mediante a confirmação de presença.</p>
          </div>
        </article>
      </div>
      <SectionControls previous={{ id: 'data' }} next={{ id: 'presenca' }} />
      <SectionNav activeSection="local" />
    </section>
  );
}

function Divider() {
  return <div className="divider"><span /><b aria-hidden="true">★</b><span /></div>;
}
