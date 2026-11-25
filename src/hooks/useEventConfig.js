import { useEffect, useState } from 'react';
import { copy, event as defaultEvent } from '../config/event.js';

function formatDateParts(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return defaultEvent.dateParts;

  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return {
    day: getPart('day') || defaultEvent.dateParts.day,
    month: getPart('month') || defaultEvent.dateParts.month,
    year: getPart('year') || defaultEvent.dateParts.year,
  };
}

export function useEventConfig() {
  const [eventConfig, setEventConfig] = useState(defaultEvent);
  const [eventDescription, setEventDescription] = useState(copy.heroDescription);

  useEffect(() => {
    let isMounted = true;

    fetch('/api/event')
      .then((response) => {
        if (!response.ok) throw new Error('Event configuration unavailable');
        return response.json();
      })
      .then(({ event: publicEvent }) => {
        if (!isMounted || !publicEvent) return;

        const weekday = new Intl.DateTimeFormat('pt-BR', {
          weekday: 'long',
          timeZone: 'America/Sao_Paulo',
        }).format(new Date(publicEvent.date));
        const mapQuery = publicEvent.mapQuery || publicEvent.address;

        setEventConfig((current) => ({
          ...current,
          title: publicEvent.title || current.title,
          dateTime: publicEvent.date || current.dateTime,
          dateParts: formatDateParts(publicEvent.date),
          weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
          time: publicEvent.timeText || current.time,
          venueName: publicEvent.venueName || '',
          address: publicEvent.address || '',
          mapUrl: mapQuery
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
            : '',
          maxCompanions: Number(publicEvent.maxCompanions ?? current.maxCompanions),
          allowChildren: Boolean(publicEvent.allowChildren),
          successMessage: publicEvent.successMessage || current.successMessage,
        }));
        setEventDescription(publicEvent.description || copy.heroDescription);
      })
      .catch(() => {
        // Mantém os dados locais para permitir a visualização sem o serviço PHP.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { eventConfig, eventDescription };
}
