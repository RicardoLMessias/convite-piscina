import { useEffect, useRef, useState } from 'react';

const DEFAULT_VOLUME = 0.15;

export default function MusicPlayer() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.volume = DEFAULT_VOLUME;
    let isDisposed = false;
    const removeGestureListeners = () => {
      document.removeEventListener('pointerdown', startAfterGesture);
      document.removeEventListener('keydown', startAfterGesture);
    };
    const startAfterGesture = (event) => {
      if (event.target instanceof Element && event.target.closest('.music-player')) return;

      audio.play()
        .then(() => {
          if (!isDisposed) setIsPlaying(true);
          removeGestureListeners();
        })
        .catch(() => {});
    };

    document.addEventListener('pointerdown', startAfterGesture);
    document.addEventListener('keydown', startAfterGesture);

    const attemptAutoplay = async () => {
      try {
        await audio.play();
        if (!isDisposed) setIsPlaying(true);
        removeGestureListeners();
      } catch {
        if (!isDisposed) setIsPlaying(false);
      }
    };

    attemptAutoplay();
    return () => {
      isDisposed = true;
      removeGestureListeners();
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }

  function changeVolume(event) {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    if (audioRef.current) audioRef.current.volume = nextVolume;
  }

  return (
    <aside className="music-player" aria-label="Player de música">
      <audio
        ref={audioRef}
        src="/assets/g-major-groove.mp3"
        autoPlay
        loop
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <span className="music-player-note" aria-hidden="true">♫</span>
      <button
        className="music-player-toggle"
        type="button"
        onClick={togglePlayback}
        aria-label={isPlaying ? 'Pausar música' : 'Reproduzir música'}
        title={isPlaying ? 'Pausar música' : 'Reproduzir música'}
      >
        {isPlaying ? 'Ⅱ' : '▶'}
      </button>
      <label className="music-player-volume">
        <span className="visually-hidden">Volume da música</span>
        <span className="music-player-volume-icon" aria-hidden="true">♪</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={changeVolume}
          aria-label="Volume da música"
        />
      </label>
    </aside>
  );
}
