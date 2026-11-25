import { copy } from '../../config/event.js';
import PoolDecorations from '../layout/PoolDecorations.jsx';
import SectionControls from '../navigation/SectionControls.jsx';
import SectionNav from '../navigation/SectionNav.jsx';

export default function DateSection({ eventConfig, countdown }) {
  const monthNumber = new Intl.DateTimeFormat('pt-BR', {
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(eventConfig.dateTime));

  return (
    <section
      className="page details"
      id="data"
      aria-labelledby="date-title"
    >
      <PoolDecorations scene="date" />
      <div className="section-inner info-layout">
        <article className="info-card date-card">
          <span className="tag tag-pink">Data</span>
          <h2 className="date-value" id="date-title">
            {eventConfig.dateParts.day}/{monthNumber}/{eventConfig.dateParts.year}
          </h2>
          <Divider />
          <p className="countdown-label">Faltam</p>
          <div className="countdown" aria-label="Contagem regressiva">
            {countdown.map(({ value, label, pad }) => (
              <div className="countdown-unit" key={label}>
                <strong>{String(value).padStart(pad, '0')}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <Divider />
          <span className="tag tag-yellow">Horário</span>
          <p className="time-value">{eventConfig.time}</p>
        </article>
      </div>
      <SectionControls previous={{ id: 'inicio' }} next={{ id: 'local' }} />
      <SectionNav activeSection="data" />
    </section>
  );
}

function Divider() {
  return <div className="divider"><span /><b aria-hidden="true">★</b><span /></div>;
}
