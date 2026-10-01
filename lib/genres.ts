/**
 * Genres are the sections of the game. Each has its own prompt every day, its own run (one try per device per
 * day), its own score and its own leaderboard. A genre draws its daily prompt from the categories (which spawn
 * "starts with X" prompts) and niche prompts listed here; every id must exist in data/prompts.ts.
 */
export interface Genre {
  id: string;
  name: string;
  /** The main daily question: broad, drawn from every genre's pool, and the only one that counts towards the streak. */
  main?: boolean;
  categories: string[];
  niche: string[];
}

/** The main game. Its pool is every category and niche prompt (see promptForDate), so it lists none itself. */
export const MAIN_GENRE_ID = "general";

export const GENRES: Genre[] = [
  { id: MAIN_GENRE_ID, name: "Today's Question", main: true, categories: [], niche: [] },
  {
    id: "nature", name: "Animals & Nature",
    categories: ["animals", "plants"], niche: ["red-things", "animals-stripes", "animals-no-legs", "nocturnal", "pink-animals", "flowers-edible", "trees-fruit", "insects-fly", "animals-one-word-two-meanings", "things-in-pond"],
  },
  {
    id: "places", name: "Places",
    categories: ["cities"], niche: ["landlocked", "rivers-flow-north", "islands-people", "mountain-ranges", "us-states-cities", "countries-flag-red", "things-airport", "things-beach", "places-quiet"],
  },
  {
    id: "screen", name: "Movies & TV",
    categories: ["movies", "tv-shows", "fictional-characters"], niche: ["number-movies", "animated-characters", "sidekicks", "villains", "movie-one-word", "sitcom-characters", "films-animals-title", "tv-shows-set-school", "superheroes"],
  },
  {
    id: "music", name: "Music",
    categories: ["songs", "bands"], niche: ["color-songs", "number-songs", "the-bands", "instruments-blow", "instruments-strike", "songs-weather", "songs-names-title", "one-word-bands", "musical-terms"],
  },
  {
    id: "words", name: "Words & Names",
    categories: ["verbs", "adjectives", "jobs", "boys-names", "girls-names", "surnames"], niche: ["noun-verbs", "words-double-letters", "words-one-syllable-animals", "names-also-things", "words-ending-ing", "compound-words", "words-five-letters-q", "palindromes"],
  },
  {
    id: "everything", name: "Everything Else",
    categories: ["brands"], niche: ["wheels-not-transport", "phone-touch", "things-in-pocket", "things-with-keys", "things-with-teeth", "things-with-eyes", "things-with-handles", "things-with-buttons", "things-in-bathroom", "things-with-wings", "things-squeeze", "things-that-melt", "things-bounce", "things-made-glass", "things-in-garage", "things-sticky", "sports-ball", "things-you-wear-feet", "things-in-school-bag"],
  },
];

/** The optional extras: every genre except the main question. */
export const EXTRA_GENRES = GENRES.filter((g) => !g.main);

export const genreById = (id: string): Genre | undefined => GENRES.find((g) => g.id === id);
export const isGenre = (id: unknown): id is string => typeof id === "string" && GENRES.some((g) => g.id === id);
