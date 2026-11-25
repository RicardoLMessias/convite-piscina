import { useCountdown } from './hooks/useCountdown.js';
import { useEventConfig } from './hooks/useEventConfig.js';
import { useWaterMotion } from './hooks/useWaterMotion.js';
import WaterBackground from './components/layout/WaterBackground.jsx';
import MusicPlayer from './components/layout/MusicPlayer.jsx';
import HeroSection from './components/sections/HeroSection.jsx';
import DateSection from './components/sections/DateSection.jsx';
import LocationSection from './components/sections/LocationSection.jsx';
import RsvpSection from './components/sections/RsvpSection.jsx';

export default function App() {
  const { eventConfig, eventDescription } = useEventConfig();
  const countdown = useCountdown(eventConfig.dateTime);
  const motionRef = useWaterMotion();

  return (
    <>
      <WaterBackground />
      <MusicPlayer />
      <main ref={motionRef}>
        <HeroSection eventConfig={eventConfig} description={eventDescription} />
        <DateSection eventConfig={eventConfig} countdown={countdown} />
        <LocationSection eventConfig={eventConfig} />
        <RsvpSection eventConfig={eventConfig} />
      </main>
    </>
  );
}
