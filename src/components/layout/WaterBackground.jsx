import { useEffect } from 'react';

export default function WaterBackground() {
  useEffect(() => {
    const existingScript = document.querySelector('[data-water-effect]');
    if (existingScript) return undefined;

    const script = document.createElement('script');
    script.src = '/water-3d.js?v=20260927-2';
    script.dataset.waterEffect = 'true';
    document.body.appendChild(script);
  }, []);

  return (
    <div className="water-background" aria-hidden="true">
      <canvas id="water-3d-canvas" />
    </div>
  );
}
