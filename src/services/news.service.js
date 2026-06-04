const axios = require("axios");

const CATEGORY_MAP = {
  headlines: "general",
  "top stories": "general",
  business: "business",
  technology: "technology",
  entertainment: "entertainment",
  sports: "sports",
  health: "health",
  science: "science",
};

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1200&q=80",
];

const FALLBACK_NEWS = [
  ["Global live briefing", "Top Stories", "Global", "Major political, market, technology, sport, and culture updates from around the world."],
  ["Nigeria today", "Top Stories", "Nigeria", "A daily roundup of national headlines, public updates, business, entertainment, and social conversations."],
  ["Local updates near you", "Local", "Local", "Community events, security notices, transport updates, weather impact, and local public announcements."],
  ["Markets and economy watch", "Business", "Global", "Currency, company, policy, startup, and consumer-market movement shaping the business day."],
  ["Technology digest", "Technology", "Global", "AI, startups, mobile platforms, cybersecurity, creator tools, and product-launch stories."],
  ["Entertainment roundup", "Entertainment", "Global", "Film, music, celebrity, streaming, creator, and culture stories trending today."],
  ["Sports pulse", "Sports", "Global", "Match previews, results, transfer updates, tournament highlights, and athlete stories."],
  ["Health and science brief", "Health", "Global", "Research, public-health updates, climate, science, and medical developments."],
].map(([title, category, region, summary], index) => ({
  id: `fallback-${index}`,
  title,
  summary,
  category,
  region,
  source: "NendPlay News Desk",
  imageUrl: FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
  url: "",
  publishedAt: new Date(Date.now() - index * 3600000).toISOString(),
}));

function normalizeArticle(article, index, defaults = {}) {
  return {
    id: article.url || `${article.title || "news"}-${index}`,
    title: article.title || "Untitled story",
    summary: article.description || article.content || "Open this story for more details.",
    category: defaults.category || article.category || "Top Stories",
    region: defaults.region || article.region || "Global",
    source: article.source?.name || article.source || "News source",
    imageUrl: article.urlToImage || article.image || article.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    url: article.url || "",
    publishedAt: article.publishedAt || new Date().toISOString(),
  };
}

function getCountryCode(country = "") {
  const normalized = String(country || "").trim().toUpperCase();
  if (!normalized) return "";
  if (normalized.length === 2) return normalized.toLowerCase();

  const map = {
    NIGERIA: "ng",
    "UNITED STATES": "us",
    USA: "us",
    "UNITED KINGDOM": "gb",
    UK: "gb",
    CANADA: "ca",
    GHANA: "gh",
    KENYA: "ke",
    "SOUTH AFRICA": "za",
  };

  return map[normalized] || "";
}

function getTabConfig({ tab = "for-you", category = "", country = "", city = "", region = "" }) {
  const normalizedTab = String(tab || "for-you").toLowerCase();
  const normalizedCategory = String(category || "").toLowerCase();
  const countryCode = getCountryCode(country) || "ng";
  const cityQuery = [city, region].filter(Boolean).join(" ");

  if (normalizedTab === "local") {
    return {
      country: countryCode,
      category: "general",
      q: cityQuery || country || "local news",
      label: city || region || country || "Local",
      region: city || region || country || "Local",
    };
  }

  if (normalizedTab === "nigeria") {
    return { country: "ng", category: "general", label: "Nigeria", region: "Nigeria" };
  }

  if (normalizedTab === "world") {
    return { country: "", category: "general", q: "world", label: "World", region: "Global" };
  }

  const categoryKey = CATEGORY_MAP[normalizedTab] || CATEGORY_MAP[normalizedCategory] || "general";
  return {
    country: normalizedTab === "for-you" || normalizedTab === "headlines" ? countryCode : "",
    category: categoryKey,
    label: category || tab || "Top Stories",
    region: normalizedTab === "for-you" || normalizedTab === "headlines" ? (country || "Nigeria") : "Global",
  };
}

class NewsService {
  async getDailyNews({
    category = "",
    search = "",
    tab = "for-you",
    country = "",
    city = "",
    region = "",
    page = 1,
    limit = 20,
  }) {
    const newsApiKey = process.env.NEWS_API_KEY || "";
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const tabConfig = getTabConfig({ tab, category, country, city, region });

    if (!newsApiKey) {
      return this.getFallbackNews({
        category,
        search,
        tab,
        country,
        city,
        region,
        page: parsedPage,
        limit: parsedLimit,
      });
    }

    try {
      const params = {
        apiKey: newsApiKey,
        language: "en",
        page: parsedPage,
        pageSize: parsedLimit,
      };

      if (tabConfig.country) params.country = tabConfig.country;
      if (tabConfig.category && tabConfig.category !== "general") params.category = tabConfig.category;
      if (tabConfig.q || search) params.q = search || tabConfig.q;

      const response = await axios.get("https://newsapi.org/v2/top-headlines", {
        params,
        timeout: 10000,
      });

      const articles = (response.data.articles || []).map((article, index) => (
        normalizeArticle(article, index, {
          category: tabConfig.label,
          region: tabConfig.region,
        })
      ));
      const total = response.data.totalResults || articles.length;

      return {
        articles,
        source: "newsapi",
        tab,
        location: {
          country: country || (tabConfig.country === "ng" ? "Nigeria" : ""),
          city,
          region,
        },
        updatedAt: new Date().toISOString(),
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          pages: Math.max(Math.ceil(total / parsedLimit), 1),
        },
      };
    } catch {
      return this.getFallbackNews({
        category,
        search,
        tab,
        country,
        city,
        region,
        page: parsedPage,
        limit: parsedLimit,
      });
    }
  }

  getFallbackNews({ category = "", search = "", tab = "for-you", country = "", city = "", region = "", page = 1, limit = 20 }) {
    const query = search.trim().toLowerCase();
    const tabConfig = getTabConfig({ tab, category, country, city, region });
    const normalizedTab = String(tab || "").toLowerCase();
    const filtered = FALLBACK_NEWS.filter((item) => {
      const matchesTab =
        normalizedTab === "for-you" ||
        normalizedTab === "headlines" ||
        (normalizedTab === "local" && ["Local", "Nigeria"].includes(item.region)) ||
        (normalizedTab === "nigeria" && item.region === "Nigeria") ||
        (normalizedTab === "world" && item.region === "Global") ||
        item.category.toLowerCase() === normalizedTab ||
        item.category === tabConfig.label;
      const matchesSearch = !query || `${item.title} ${item.summary} ${item.category} ${item.region}`
        .toLowerCase()
        .includes(query);
      return matchesTab && matchesSearch;
    });

    const start = (page - 1) * limit;
    const articles = filtered.slice(start, start + limit);

    return {
      articles,
      source: "fallback",
      tab,
      location: { country, city, region },
      updatedAt: new Date().toISOString(),
      pagination: {
        total: filtered.length,
        page,
        limit,
        pages: Math.max(Math.ceil(filtered.length / limit), 1),
      },
    };
  }
}

module.exports = new NewsService();
