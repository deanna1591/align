// Curated quote bank for Align — mixed tones, no fortune-cookie energy.
// Edit freely. Quotes rotate deterministically by date, so swaps stick all day.

export const DAILY_QUOTES = [
  // attributed — real writers and thinkers, lines that actually mean something
  { text: 'How we spend our days is, of course, how we spend our lives.', author: 'Annie Dillard' },
  { text: 'Action is the antidote to despair.', author: 'Joan Baez' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Time is the substance from which I am made.', author: 'Borges' },
  { text: 'Attention is the rarest and purest form of generosity.', author: 'Simone Weil' },
  { text: 'What you do every day matters more than what you do once in a while.', author: 'Gretchen Rubin' },
  { text: "What we choose to do, we choose to become.", author: 'Heraclitus' },

  // unattributed — notes-to-self, journal aphorisms
  { text: 'Begin where you are.' },
  { text: 'Today is enough to be today.' },
  { text: 'Three things, done well, beats ten half-finished.' },
  { text: 'Pick three. Close the day.' },
  { text: "Small enough to start — that's the only rule." },
  { text: 'The list will keep.' },
  { text: 'Stop reading. Start one.' },
  { text: 'One thing at a time is still a thing.' },
  { text: 'Doing the work is the work.' },
  { text: 'Show up. Even halfway.' },
  { text: 'Most days are middle days. Make them count.' },
  { text: 'Constraints are kind.' },
  { text: 'Quiet days build loud lives.' },
  { text: 'Done is a kind of perfect.' },
  { text: 'Build the habit, not the highlight reel.' },
  { text: 'What gets your attention gets your life.' },
  { text: 'You can rest after. Not instead.' },
  { text: "Don't optimize. Just begin." },
  { text: 'The hard part is starting.' },
];

export const COMPLETION_QUOTES = [
  { line: "That's the three.",         sub: 'Earned a rest.' },
  { line: 'Closed.',                   sub: 'You stayed the course.' },
  { line: 'Three down.',               sub: 'The day owes you nothing.' },
  { line: "That's the work.",          sub: 'Now go do something restorative.' },
  { line: 'Today: closed.',            sub: 'Same again tomorrow?' },
  { line: 'Three for three.',          sub: 'Build the habit, not the highlight reel.' },
  { line: 'Done.',                     sub: 'The good kind of done.' },
  { line: 'Quiet win.',                sub: 'These add up.' },
  { line: "Today's three: complete.",  sub: 'Close the laptop with a clear conscience.' },
];

// Tiny deterministic hash of a date string → an index in the array.
// No Math.random — quote stays stable through the day.
function hashIndex(seed, modulo) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h) % modulo;
}

export function getDailyQuote(dateStr) {
  return DAILY_QUOTES[hashIndex(dateStr, DAILY_QUOTES.length)];
}

export function getCompletionQuote(dateStr) {
  // Different namespace from daily so they aren't correlated.
  return COMPLETION_QUOTES[hashIndex('completion::' + dateStr, COMPLETION_QUOTES.length)];
}
