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
    categories: ["animals", "plants"], niche: ["birds", "flowers", "trees", "insects", "african-animals"],
  },
  {
    id: "places", name: "Places",
    categories: ["cities"], niche: ["european-cities", "us-cities", "rivers", "mountains", "islands"],
  },
  {
    id: "screen", name: "Movies & TV",
    categories: ["movies", "tv-shows", "fictional-characters"], niche: ["number-movies", "superheroes"],
  },
  {
    id: "music", name: "Music",
    categories: ["songs", "bands"], niche: ["color-songs", "number-songs", "the-bands"],
  },
  {
    id: "words", name: "Words & Names",
    categories: ["verbs", "adjectives", "jobs", "boys-names", "girls-names", "surnames"], niche: ["noun-verbs"],
  },
  {
    id: "everything", name: "Everything Else",
    categories: ["brands"], niche: ["kitchen", "red-things", "yellow-things", "green-things", "fly", "wheels", "wear", "round", "garage", "school", "sports"],
  },
];

/** The optional extras: every genre except the main question. */
export const EXTRA_GENRES = GENRES.filter((g) => !g.main);

export const genreById = (id: string): Genre | undefined => GENRES.find((g) => g.id === id);
export const isGenre = (id: unknown): id is string => typeof id === "string" && GENRES.some((g) => g.id === id);
