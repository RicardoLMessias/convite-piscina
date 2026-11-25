import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { copy } from '../../config/event.js';
import PoolDecorations from '../layout/PoolDecorations.jsx';
import SectionControls from '../navigation/SectionControls.jsx';
import SectionNav from '../navigation/SectionNav.jsx';

function createCompanion() {
  return {
    id: `${Date.now()}-${Math.random()}`,
    name: '',
    type: 'adult',
  };
}

function createWhatsAppUrl(phone, message) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  let whatsappNumber = '';

  if (digits.length === 10 || digits.length === 11) {
    whatsappNumber = `55${digits}`;
  } else if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    whatsappNumber = digits;
  } else if (digits.length >= 12 && digits.length <= 15) {
    whatsappNumber = digits;
  }

  return whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : '';
}

export default function RsvpSection({ eventConfig }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const modalRef = useRef(null);
  const [companions, setCompanions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [whatsAppUrl, setWhatsAppUrl] = useState('');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [canShareOnWhatsApp, setCanShareOnWhatsApp] = useState(false);
  const [invitationImageFile, setInvitationImageFile] = useState(null);
  const [confirmationId, setConfirmationId] = useState('');
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const lastResponsibleEmail = useRef('');

  useEffect(() => {
    if (!isFormOpen) return undefined;
    if (!modalRef.current?.open) modalRef.current?.showModal();
    return undefined;
  }, [isFormOpen]);

  useEffect(() => {
    let isMounted = true;

    fetch('/assets/convite-email.png?v=20260927-endereco-destacado')
      .then((response) => (response.ok ? response.blob() : null))
      .then((imageBlob) => {
        if (!isMounted || !imageBlob || !imageBlob.type.startsWith('image/')) return;
        setInvitationImageFile(new File([imageBlob], 'convite-email.png', {
          type: imageBlob.type,
        }));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  function addCompanion() {
    if (companions.length >= eventConfig.maxCompanions) return;
    setCompanions((current) => [...current, createCompanion()]);
  }

  function updateCompanion(id, changes) {
    setCompanions((current) => current.map((companion) =>
      companion.id === id ? { ...companion, ...changes } : companion,
    ));
  }

  function removeCompanion(id) {
    setCompanions((current) => current.filter((companion) => companion.id !== id));
  }

  async function submitConfirmation(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setWhatsAppUrl('');
    setCanShareOnWhatsApp(false);
    setConfirmationId('');

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      responsibleName: formData.get('responsibleName'),
      responsiblePhone: formData.get('responsiblePhone'),
      responsibleEmail: formData.get('responsibleEmail'),
      willAttend: formData.get('willAttend'),
      guests: companions.map(({ name, type }) => ({ name, type })),
    };
    lastResponsibleEmail.current = payload.responsibleEmail;

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Não foi possível salvar a confirmação.');
      }

      const duplicates = result.duplicates || [];
      const savedGuests = result.savedGuests || [];
      const exactDuplicates = duplicates.filter(({ type }) => type === 'exact').length;
      const possibleDuplicates = duplicates.filter(({ type }) => type === 'possible').length;
      const summary = `${savedGuests.length} pessoa(s) nova(s), ${exactDuplicates} duplicada(s) exata(s) e ${possibleDuplicates} possível(is) duplicada(s).`;
      const eventDetails = result.eventDetails;

      const emailNotice = result.emailSent
        ? ' Enviamos uma cópia para o e-mail informado.'
        : ' Não foi possível enviar o e-mail agora; sua confirmação foi salva.';
      const imageHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? 'https://conviteolivia.drkworks.com.br'
        : window.location.origin;
      const invitationImageUrl = new URL(
        '/assets/convite-email.png?v=20260927-endereco-destacado',
        imageHost,
      ).href;
      const whatsappText = [
        `Confirmação da festa de ${eventConfig.honoree || 'Olivia Maria'}`,
        `Responsável: ${payload.responsibleName}`,
        `Presença: ${payload.willAttend === 'no' ? 'não vou comparecer' : 'vou comparecer'}`,
        `Convidados: ${[payload.responsibleName, ...payload.guests.map(({ name }) => name)].join(', ')}`,
        `Data: ${eventConfig.dateParts.day} de ${eventConfig.dateParts.month} de ${eventConfig.dateParts.year}`,
        `Horário: ${eventConfig.time}`,
        'Programação:',
        ...(eventConfig.program || []).map(({ time, activity }) => `${time} — ${activity}`),
        'Vá com roupa de banho!',
        ...(payload.willAttend === 'no' || !eventDetails?.address
          ? ['O endereço será liberado mediante a confirmação de presença.']
          : [
              `Endereço: ${eventDetails.address}`,
              ...(eventDetails.mapUrl ? [`Mapa: ${eventDetails.mapUrl}`] : []),
            ]),
        `Imagem do convite: ${invitationImageUrl}`,
      ].join('\n');

      setMessage(`${eventConfig.successMessage}${emailNotice} ${summary}`);
      setMessageType('success');
      setConfirmationId(result.confirmation?.id || '');
      setWhatsAppMessage(whatsappText);
      setWhatsAppUrl(createWhatsAppUrl(payload.responsiblePhone, whatsappText));
      setCanShareOnWhatsApp(payload.willAttend === 'yes');
      setCompanions([]);
      form.reset();
    } catch (error) {
      const errorMessage = error instanceof TypeError
        ? 'Não foi possível conectar ao sistema de confirmação.'
        : error.message || 'Não foi possível salvar a confirmação.';
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendConfirmationEmail() {
    if (!confirmationId) return;
    setIsResendingEmail(true);

    try {
      const response = await fetch('/api/rsvp/resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationId,
          responsibleEmail: lastResponsibleEmail.current,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Não foi possível reenviar o e-mail.');
      }

      setMessage('E-mail reenviado com a imagem do convite no corpo da mensagem.');
      setMessageType('success');
    } catch (error) {
      setMessage(error.message || 'Não foi possível reenviar o e-mail.');
      setMessageType('error');
    } finally {
      setIsResendingEmail(false);
    }
  }

  async function shareOnWhatsApp() {
    if (invitationImageFile && navigator.canShare?.({ files: [invitationImageFile] })) {
      try {
        await navigator.share({
          title: `Convite — ${eventConfig.honoree || 'Olivia Maria'}`,
          text: whatsAppMessage,
          files: [invitationImageFile],
        });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }

    if (whatsAppUrl) {
      window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setMessage('Para abrir o WhatsApp com sua confirmação, informe um número de telefone no formulário.');
    setMessageType('error');
  }

  return (
    <>
      <section
        className="page rsvp"
        id="presenca"
        aria-labelledby="rsvp-title"
      >
        <PoolDecorations scene="rsvp" />
        <div className="section-inner rsvp-content">
          <article className="info-card rsvp-card">
            <span className="tag tag-pink">Presença</span>
            <h2 id="rsvp-title">{copy.rsvpTitle}</h2>
            <div className="divider">
              <span />
              <b aria-hidden="true">★</b>
              <span />
            </div>
            <div className="mini-pool" aria-hidden="true">
              <img className="mini-pool-splash" src="/assets/splash.png" alt="" />
              <img className="mini-pool-flamingo" src="/assets/flamingo.png" alt="" />
              <img className="mini-pool-ball" src="/assets/beach-ball.png" alt="" />
              <span className="mini-pool-water" />
            </div>
            <button
              className="button button-yellow rsvp-trigger"
              type="button"
              onClick={() => {
                setConfirmationId('');
                setMessage('');
                setMessageType('');
                setWhatsAppUrl('');
                setCanShareOnWhatsApp(false);
                setIsFormOpen(true);
              }}
            >
              <span aria-hidden="true">◉</span> Confirmar presença
            </button>
          </article>
        </div>
        <SectionControls previous={{ id: 'local', label: 'Voltar à página anterior' }} />
        <SectionNav activeSection="presenca" />
      </section>

      {isFormOpen && createPortal(
          <dialog
            ref={modalRef}
            className="rsvp-modal"
            aria-labelledby="rsvp-modal-title"
            onClose={() => setIsFormOpen(false)}
            onClick={(event) => {
              if (event.target !== modalRef.current) return;
              const bounds = modalRef.current.getBoundingClientRect();
              const clickedOutside = event.clientX < bounds.left
                || event.clientX > bounds.right
                || event.clientY < bounds.top
                || event.clientY > bounds.bottom;
              if (clickedOutside) modalRef.current.close();
            }}
          >
            <button
              className="rsvp-modal-close"
              type="button"
              aria-label="Fechar formulário"
              onClick={() => modalRef.current?.close()}
            >
              ×
            </button>
            <h2 id="rsvp-modal-title">Confirme sua presença</h2>
            <form className="rsvp-form" onSubmit={submitConfirmation}>
              <label className="form-field">
                <span>Seu nome completo</span>
                <input
                  name="responsibleName"
                  autoComplete="name"
                  placeholder="Seu nome completo"
                  required
                />
              </label>

              <label className="form-field">
                <span>Telefone</span>
                <input
                  name="responsiblePhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="DDD + telefone"
                />
                <small className="form-hint">Usado no botão opcional do WhatsApp após confirmar.</small>
              </label>

              <label className="form-field">
                <span>E-mail para receber a confirmação</span>
                <input
                  name="responsibleEmail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  required
                />
              </label>

              <label className="form-field">
                <span>Você vai comparecer?</span>
                <select name="willAttend" defaultValue="yes">
                  <option value="yes">Sim, vou comparecer</option>
                  <option value="no">Não vou comparecer</option>
                </select>
              </label>

              <div className="companions-heading">
                <div>
                  <strong>Acompanhantes</strong>
                  <span>O responsável já será incluído na confirmação.</span>
                </div>
                <button
                  className="add-companion"
                  type="button"
                  onClick={addCompanion}
                  disabled={companions.length >= eventConfig.maxCompanions}
                >
                  Adicionar
                </button>
              </div>

              {companions.length > 0 && (
                <div className="companions-list">
                  {companions.map((companion, index) => (
                    <div className="companion-row" key={companion.id}>
                      <label className="form-field companion-name">
                        <span>Acompanhante {index + 1}</span>
                        <input
                          name="guestName"
                          value={companion.name}
                          onChange={(event) => updateCompanion(
                            companion.id,
                            { name: event.target.value },
                          )}
                          placeholder="Nome completo"
                          required
                        />
                      </label>
                      <label className="form-field companion-type">
                        <span>Tipo</span>
                        <select
                          aria-label={`Tipo do acompanhante ${index + 1}`}
                          value={eventConfig.allowChildren ? companion.type : 'adult'}
                          disabled={!eventConfig.allowChildren}
                          onChange={(event) => updateCompanion(
                            companion.id,
                            { type: event.target.value },
                          )}
                        >
                          <option value="adult">Adulto</option>
                          <option value="child">Criança</option>
                        </select>
                      </label>
                      <button
                        className="remove-companion"
                        type="button"
                        onClick={() => removeCompanion(companion.id)}
                        aria-label={`Remover acompanhante ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="button submit-rsvp"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enviando…' : 'Enviar confirmação'}
              </button>
              <p
                className={`form-message ${messageType}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
              {confirmationId && canShareOnWhatsApp && (
                <button
                  className="button whatsapp-self-send"
                  type="button"
                  onClick={shareOnWhatsApp}
                >
                  <strong>Enviar uma cópia para o número que informou</strong>
                  <span>O WhatsApp abre com a mensagem pronta; só envia após tocar em Enviar.</span>
                </button>
              )}
              {confirmationId && (
                <div className="confirmation-actions">
                  <a
                    className="button invitation-image-link"
                    href="/assets/convite-email.png?v=20260927-endereco-destacado"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir imagem do convite
                  </a>
                  <button
                    className="button resend-confirmation-email"
                    type="button"
                    onClick={resendConfirmationEmail}
                    disabled={isResendingEmail}
                  >
                    {isResendingEmail ? 'Reenviando…' : 'Reenviar por e-mail'}
                  </button>
                </div>
              )}
            </form>
          </dialog>,
        document.body,
      )}
    </>
  );
}
