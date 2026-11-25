const assetClasses = {
  'leaves-green': 'decoration-leaves',
  'leaves-pink': 'decoration-pink-leaves',
  'beach-ball': 'decoration-beach-ball',
  'float-ring': 'decoration-float-ring',
  flamingo: 'decoration-flamingo',
  starfish: 'decoration-starfish',
  bubbles: 'decoration-bubbles',
  splash: 'decoration-splash',
};

const scenes = {
  cover: ['float-ring', 'leaves-green', 'beach-ball', 'leaves-pink', 'leaves-green', 'leaves-green', 'float-ring'],
  date: ['leaves-green', 'flamingo', 'starfish', 'beach-ball', 'float-ring', 'bubbles', 'starfish'],
  location: ['leaves-green', 'flamingo', 'starfish', 'beach-ball', 'float-ring', 'leaves-pink'],
  rsvp: ['leaves-green', 'beach-ball', 'starfish', 'float-ring', 'leaves-green', 'leaves-pink', 'bubbles'],
};

export default function PoolDecorations({ scene }) {
  return (
    <div className={`pool-decorations pool-decorations-${scene}`} aria-hidden="true">
      {scenes[scene].map((asset, index) => (
        <img
          key={`${asset}-${index}`}
          className={`pool-decoration ${assetClasses[asset]} decoration-${index + 1}`}
          src={`/assets/${asset}.png`}
          alt=""
        />
      ))}
    </div>
  );
}
