import { useEffect, useState } from 'react';

export function useCountdown(dateTime) {
  const targetTime = new Date(dateTime).getTime();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, targetTime - Date.now()),
  );

  useEffect(() => {
    const updateCountdown = () => {
      setRemaining(Math.max(0, targetTime - Date.now()));
    };

    const timerId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timerId);
  }, [targetTime]);

  const totalSeconds = Math.floor(remaining / 1000);

  return [
    { value: Math.floor(totalSeconds / 86400), label: 'dias', pad: 3 },
    { value: Math.floor((totalSeconds % 86400) / 3600), label: 'horas', pad: 2 },
    { value: Math.floor((totalSeconds % 3600) / 60), label: 'min', pad: 2 },
    { value: totalSeconds % 60, label: 'seg', pad: 2 },
  ];
}
