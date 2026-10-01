/**
 * Genres are the sections of the game. Each has its own prompt every day, its own run (one try per device per
 * day), its own score and its own leaderboard. A genre draws its daily prompt from the categories (which spawn
 * "starts with X" prompts) and niche prompts listed here; every id must exist in data/prompts.ts.
 */
export interface Genre {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  categories: string[];
  niche: string[];
}

export const GENRES: Genre[] = [
  {
    id: "nature", name: "Animals & Nature", emoji: "🐾", blurb: "Creatures, plants and the great outdoors",
    categories: ["animals", "plants"], niche: ["birds", "flowers", "trees", "insects", "african-animals"],
  },
  {
    id: "food", name: "Food & Drink", emoji: "🍜", blurb: "Everything edible and drinkable",
    categories: ["foods"], niche: ["savory", "desserts", "drinks", "kitchen"],
  },
  {
    id: "places", name: "Places", emoji: "🌍", blurb: "Cities, rivers, mountains and islands",
    categories: ["cities"], niche: ["european-cities", "us-cities", "rivers", "mountains", "islands"],
  },
  {
    id: "screen", name: "Movies & TV", emoji: "🎬", blurb: "Films, shows and the characters in them",
    categories: ["movies", "tv-shows", "fictional-characters"], niche: ["number-movies", "superheroes"],
  },
  {
    id: "music", name: "Music", emoji: "🎵", blurb: "Songs and the bands who play them",
    categories: ["songs", "bands"], niche: ["color-songs", "number-songs", "the-bands"],
  },
  {
    id: "games", name: "Games", emoji: "🎮", blurb: "Video games and the worlds inside them",
    categories: ["video-games"], niche: ["pokemon", "video-game-characters", "minecraft"],
  },
  {
    id: "words", name: "Words & Names", emoji: "🔤", blurb: "Verbs, jobs, names and more",
    categories: ["verbs", "adjectives", "jobs", "boys-names", "girls-names", "surnames"], niche: ["noun-verbs"],
  },
  {
    id: "everything", name: "Everything Else", emoji: "🎲", blurb: "Brands, colours, shapes and odd ones",
    categories: ["brands"], niche: ["red-things", "yellow-things", "green-things", "fly", "wheels", "wear", "round", "garage", "school", "sports"],
  },
];

export const genreById = (id: string): Genre | undefined => GENRES.find((g) => g.id === id);
export const isGenre = (id: unknown): id is string => typeof id === "string" && GENRES.some((g) => g.id === id);
