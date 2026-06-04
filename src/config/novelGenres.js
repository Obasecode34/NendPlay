const NOVEL_GENRES = [
  { key: "business", label: "Business" },
  { key: "love", label: "Love" },
  { key: "finance", label: "Finance" },
  { key: "drama", label: "Drama" },
  { key: "fiction", label: "Fiction" },
  { key: "non-fiction", label: "Non-Fiction" },
  { key: "mystery", label: "Mystery" },
  { key: "horror", label: "Horror" },
  { key: "fan-fiction", label: "Fan Fiction" },
  { key: "sci-fi", label: "Sci-Fi" },
  { key: "urban", label: "Urban" },
  { key: "teen", label: "Teen" },
  { key: "military-history", label: "Military & History" },
  { key: "games-sport", label: "Games & Sport" },
  { key: "literature", label: "Literature" },
  { key: "eastern-fantasy", label: "Eastern Fantasy" },
  { key: "western-fantasy", label: "Western Fantasy" },
];

const DEFAULT_NOVEL_GENRE = "fiction";

const GENRE_ALIASES = {
  game: "games-sport",
  games: "games-sport",
  sport: "games-sport",
  sports: "games-sport",
  "games-and-sport": "games-sport",
  "game-sport": "games-sport",
  history: "military-history",
  military: "military-history",
  "military-and-history": "military-history",
  fanfiction: "fan-fiction",
  "science-fiction": "sci-fi",
  scifi: "sci-fi",
  fantasy: "western-fantasy",
  general: DEFAULT_NOVEL_GENRE,
  novel: DEFAULT_NOVEL_GENRE,
  novels: DEFAULT_NOVEL_GENRE,
};

function slugifyGenre(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeNovelGenre(value = "") {
  const slug = slugifyGenre(value);
  const aliased = GENRE_ALIASES[slug] || slug;
  return NOVEL_GENRES.some((genre) => genre.key === aliased)
    ? aliased
    : DEFAULT_NOVEL_GENRE;
}

function isNovelGenre(value = "") {
  const slug = slugifyGenre(value);
  const aliased = GENRE_ALIASES[slug] || slug;
  return NOVEL_GENRES.some((genre) => genre.key === aliased);
}

module.exports = {
  NOVEL_GENRES,
  DEFAULT_NOVEL_GENRE,
  normalizeNovelGenre,
  isNovelGenre,
};
