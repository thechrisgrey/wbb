// Curated presentation data. Every line of copy here is hers (from woodbabybuilds.com) unless marked "ours".
// Prices, options and descriptions come from catalog.json, generated from her live Shopify catalog.

export const BRAND = {
  name: 'WoodBaby',
  long: 'Wood Baby Builds',
  short: 'WBB',
  tagline: 'absurdly well made.',
  kicker: 'WoodBaby · Goods & Wares',
  sub: 'functional art',
  lede: 'Bold, handmade wood goods for the home — statement objects for every room, made by the woman you watch make them.',
  store: 'https://woodbabybuilds.com',
  shopAll: 'https://woodbabybuilds.com/collections/shop-all-1',
  contact: 'https://woodbabybuilds.com/pages/contact',
  city: 'Nashville, TN',
};

export const MISSION = {
  kicker: 'The mission',
  title: 'Everyday objects, made into functional art.',
  body: [
    'WoodBaby began with a degree in fine art and photography with one simple belief: the things you live with every day should be beautiful too.',
    "The mission is to turn ordinary objects into functional art — pieces that don't just do a job, but reflect the person they belong to.",
    'Each one is made by hand and built to a standard that lasts — meant to be used, loved, and celebrated down for generations.',
  ],
};

export const VALUES = [
  { word: 'Bold.', line: 'Objects with real personality.' },
  { word: 'Loud.', line: 'Because ordinary is overrated.' },
  { word: 'Classic.', line: 'Made to outlast the trends.' },
];

export const SHOP_ALL_COPY =
  "Objects built with intention. Every WoodBaby piece starts as raw material and gets shaped by hand — traditional techniques, modern design, and real respect for the wood. From charred Yakisugi finishes to driftwood pulled straight off the shores of Puerto Rico, no two turn out quite alike. Some are everyday staples you'll reach for daily; some are one-of-one collector pieces you'll never see twice. If you want something with actual character instead of another mass-produced box, you're in the right place.";

export const ROOMS = [
  {
    key: 'kitchen',
    title: 'Kitchen + Table',
    kicker: 'for the counter',
    url: 'https://woodbabybuilds.com/collections/kitchen-table',
    cover: ['the-butterfly-board', 0],
    blurb: '',
  },
  {
    key: 'bath',
    title: 'Bed + Bath',
    kicker: 'for slow nights & slower mornings',
    url: 'https://woodbabybuilds.com/collections/bathroom',
    cover: ['nightcap-bath-tray', 4],
    blurb:
      'The bathroom is the most-used room in the house and usually the most ignored. Not anymore. Solid wood pieces built to handle steam, splashes, and daily use without flinching. Absurdly well made, for the room you start and end every day in.',
  },
  {
    key: 'home',
    title: 'Home + Furniture',
    kicker: 'for every other room',
    url: 'https://woodbabybuilds.com/collections/homewares',
    cover: ['yakisugi-crane-wooden-stool', 4],
    blurb:
      "The pieces that make a house feel like yours. A stool that's actually worth looking at, a bench built to be passed down, a spot by the door where your keys finally live. Solid wood, real brass, and handmade in Nashville — no flat-pack, no particleboard, no beige. Absurdly well made, for every room that isn't the kitchen or the bath.",
  },
];

export const FEATURE = {
  kicker: 'Fan favorite',
  title: "A bath tray so good you'll invent reasons to bathe.",
  body: 'Solid walnut, hand-finished, built to sit across your tub and hold the wine, the book, the whole ritual. The "I deserve this" object.',
  cta: 'Shop the bath tray',
  price: '$245',
  handle: 'nightcap-bath-tray',
  alt: 'walnut-bath-tray',
};

export const CUSTOM = {
  title: 'Straight from your imagination.',
  body: 'If you are looking for a custom item to made based off of a current product or even straight from your imagination please reach out. I will respond within 24hrs.',
  cta: 'Start a custom piece',
  url: 'https://woodbabybuilds.com/pages/contact',
};

export const NEWSLETTER = {
  title: 'Subscribe to our emails',
  body: 'Subscribe to get special offers, free giveaways, and once-in-a-lifetime deals.',
};

// The six cards from her Socials page, with her own images, labels and lines.
export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', line: 'Post and Reels', cta: 'Take a Look', url: 'https://www.instagram.com/woodbabybuilds', handle: '@woodbabybuilds' },
  { key: 'fanfix', label: 'FanFix', line: 'Exclusively Me <3', cta: 'Talk to Me Here', url: 'https://app.fanfix.io/@woodbaby', handle: '@woodbaby' },
  { key: 'x', label: 'X', line: 'Stay Up to Date', cta: 'Follow', url: 'https://x.com/woodbabybuilds', handle: '@woodbabybuilds' },
  { key: 'snapchat', label: 'Snapchat', line: 'Real Time Updates', cta: 'Follow', url: 'https://snapchat.com/t/t1gOsgwD', handle: 'onlywoodbaby' },
  { key: 'kick', label: 'Kick', line: 'Daily Live Stream', cta: 'Watch Now', url: 'https://kick.com/woodbaby', handle: 'woodbaby' },
  { key: 'discord', label: 'Discord', line: "Wood's Babies Community", cta: 'Join', url: 'https://discord.com/invite/2KuNqrVF6J', handle: "Wood's Babies" },
];

export const MORE_SOCIALS = [
  { label: 'YouTube', url: 'https://www.youtube.com/woodbabybuild' },
  { label: 'TikTok', url: 'https://tiktok.com/@woodbabylife' },
  { label: 'Facebook', url: 'https://facebook.com/woodbabybuilds' },
];

// Her 15-second stool build, re-cut in build order. Times are seconds into public/media/video/build-*.mp4.
// One-word captions are ours; the footage and the piece are hers.
export const BUILD_VIDEO = {
  src1080: 'media/video/build-1080.mp4',
  src720: 'media/video/build-720.mp4',
  poster: 'media/video/build-poster.webp',
  duration: 15.63,
  product: 'yakisugi-crane-wooden-stool',
  chapters: [
    { t: 0, key: 'cut', word: 'Cut.' },
    { t: 1.57, key: 'join', word: 'Join.' },
    { t: 4.83, key: 'clamp', word: 'Clamp.' },
    { t: 7.4, key: 'burn', word: 'Burn.' },
    { t: 9.47, key: 'paint', word: 'Paint.' },
    { t: 12.47, key: 'reveal', word: 'Reveal.' },
    { t: 13.77, key: 'sit', word: 'Sit.' },
  ],
};

// Wood species the 3D models can wear. `tex` is a file in public/media/textures cut from her own product photos.
export const WOODS = {
  walnut: { label: 'Walnut', tex: 'walnut', tint: '#93745f', swatch: '#5b3a24', roughness: 0.5 },
  oak: { label: 'Oak', tex: 'oak', tint: '#e9d6ba', swatch: '#c99a63', roughness: 0.6 },
  maple: { label: 'Maple', tex: 'maple', tint: '#f6ead8', swatch: '#e2cba9', roughness: 0.58 },
  mahogany: { label: 'Mahogany', tex: 'mahogany', tint: '#f2c4aa', swatch: '#8a3f22', roughness: 0.5 },
  rosewood: { label: 'Bolivian Rosewood', tex: 'rosewood', tint: '#f6cdb8', swatch: '#4a1d10', roughness: 0.46 },
  ebonized: { label: 'Yakisugi', tex: 'ebonized', tint: '#c9c2bb', swatch: '#1f1a17', roughness: 0.74 },
};

// Display order, the short line for each piece (her words, lightly trimmed), which photo leads, and the woods on offer.
// `woods[0]` is the species the piece is shown in first. `woodLabels` renames a species for one product.
export const PIECES = [
  { handle: 'yakisugi-crane-wooden-stool', line: 'Old technique, quiet drama.', cover: 4, woods: ['ebonized'], badge: 'One of one' },
  { handle: 'the-entry-valet', line: 'Same mirror, new story.', cover: 0, woods: ['walnut'] },
  { handle: 'nightcap-bath-tray', line: 'Your wine stays put.', cover: 4, woods: ['rosewood', 'walnut', 'oak', 'maple'], badge: 'Fan favorite' },
  { handle: 'the-cornerstone-block', line: 'The piece the rest of your kitchen answers to.', cover: 1, woods: ['walnut', 'oak'] },
  { handle: 'the-butterfly-board', line: 'A joint so pretty it shows off.', cover: 0, woods: ['walnut', 'oak'] },
  { handle: 'walnut-bench', line: 'The heirloom. Made to order.', cover: 3, woods: ['walnut'] },
  { handle: 'walnut-tray', line: "The tray everyone calls 'the good one.'", cover: 3, woods: ['walnut', 'oak'] },
  { handle: 'paper-towel-holder', line: 'Makes the most ignored thing on your counter worth looking at.', cover: 0, woods: ['ebonized', 'oak', 'walnut', 'maple'], woodLabels: { ebonized: 'Black Stain' } },
  { handle: 'catch-it-all-tray', line: 'The grain does all the decorating.', cover: 2, woods: ['mahogany', 'walnut', 'oak'] },
  { handle: 'walnut-bath-tray', line: "The 'I deserve this' piece.", cover: 0, woods: ['walnut', 'oak'] },
  { handle: 'the-chelsea-tray', line: 'Brings a little occasion to an ordinary night.', cover: 0, woods: ['walnut', 'oak'] },
  { handle: 'brass-filter-holder', line: 'The setup your coffee ritual deserves.', cover: 0, woods: ['walnut', 'maple'], woodLabels: { maple: 'Birds-Eye Maple' } },
  { handle: 'tea-tray', line: 'A cluttered counter, turned calm morning ritual.', cover: 1, woods: ['walnut'] },
  { handle: 'walnut-serving-tray', line: 'The one guests comment on.', cover: 0, woods: ['walnut', 'maple', 'oak'] },
  { handle: 'office-tray', line: 'Where the everyday pile finally lands.', cover: 0, woods: ['walnut', 'maple', 'ebonized'], woodLabels: { maple: 'Birds-Eye Maple' } },
  { handle: 'the-snack-tray', line: 'Small, mighty, rides in every order.', cover: 0, woods: ['walnut', 'oak'] },
  { handle: 'stashbox', line: 'Everything you need in one considered place.', cover: 3, woods: ['mahogany'], woodLabels: { mahogany: 'Jatoba' } },
];

export const ROOM_LABEL = { kitchen: 'Kitchen', bath: 'Bath', home: 'Home' };
