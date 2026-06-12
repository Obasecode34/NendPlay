const axios = require("axios");
const NewsPost = require("../models/NewsPost");
const cloudinaryService = require("./cloudinary.service");

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

const NEWS_CATEGORIES = [
  "for-you",
  "headlines",
  "local",
  "nigeria",
  "world",
  "business",
  "technology",
  "entertainment",
  "sports",
  "science",
  "health",
];

function normalizeList(value, max = 5) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))].slice(0, max);
}

function isVideoFile(file = {}) {
  return String(file.mimetype || "").startsWith("video/");
}

function toPublicNewsPost(post) {
  const mediaFiles = [...(post.mediaFiles || [])].sort((a, b) => {
    if (a.type === b.type) return (a.order || 0) - (b.order || 0);
    return a.type === "video" ? -1 : 1;
  });
  const firstImage = mediaFiles.find((item) => item.type === "image");
  const firstVideo = mediaFiles.find((item) => item.type === "video");

  return {
    id: post._id.toString(),
    _id: post._id,
    kind: "nendplay",
    title: post.header,
    header: post.header,
    subHeader: post.subHeader,
    summary: post.subHeader || post.body.slice(0, 180),
    body: post.body,
    categories: post.categories || [],
    category: post.categories?.[0] || "Top Stories",
    source: post.source || "NendPlay News",
    imageUrl: firstImage?.url || firstVideo?.url || "",
    mediaFiles,
    url: "",
    publishedAt: post.createdAt,
    commentCount: post.commentCount || 0,
    shareCount: post.shareCount || 0,
    likeCount: post.likeCount || 0,
    adsEnabled: post.adsEnabled !== false,
  };
}

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
  async listInternalNews({
    category = "",
    search = "",
    tab = "for-you",
    page = 1,
    limit = 20,
    includeDrafts = false,
  } = {}) {
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const filter = includeDrafts ? {} : { status: "published" };
    const categoryKey = String(category || tab || "").trim().toLowerCase();

    if (categoryKey && !["for-you", "headlines"].includes(categoryKey)) {
      filter.categories = { $in: [categoryKey, categoryKey.replace(/-/g, " ")] };
    }

    if (search && String(search).trim()) {
      filter.$text = { $search: String(search).trim() };
    }

    const [posts, total] = await Promise.all([
      NewsPost.find(filter)
        .populate("createdBy", "username profileName profilePic role")
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean(),
      NewsPost.countDocuments(filter),
    ]);

    return {
      articles: posts.map(toPublicNewsPost),
      total,
      page: parsedPage,
      limit: parsedLimit,
      pages: Math.max(Math.ceil(total / parsedLimit), 1),
    };
  }

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
    const internal = await this.listInternalNews({
      category,
      search,
      tab,
      page: parsedPage,
      limit: parsedLimit,
    });

    if (internal.articles.length >= parsedLimit || search) {
      return {
        articles: internal.articles,
        source: "nendplay",
        tab,
        location: { country, city, region },
        updatedAt: new Date().toISOString(),
        pagination: {
          total: internal.total,
          page: parsedPage,
          limit: parsedLimit,
          pages: internal.pages,
        },
      };
    }

    if (!newsApiKey) {
      const fallback = this.getFallbackNews({
        category,
        search,
        tab,
        country,
        city,
        region,
        page: parsedPage,
        limit: parsedLimit,
      });
      return {
        ...fallback,
        articles: [...internal.articles, ...fallback.articles].slice(0, parsedLimit),
      };
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

      const merged = [...internal.articles, ...articles].slice(0, parsedLimit);

      return {
        articles: merged,
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
      const fallback = this.getFallbackNews({
        category,
        search,
        tab,
        country,
        city,
        region,
        page: parsedPage,
        limit: parsedLimit,
      });
      return {
        ...fallback,
        articles: [...internal.articles, ...fallback.articles].slice(0, parsedLimit),
      };
    }
  }

  async createNewsPost({ body = {}, files = [], adminId }) {
    const categories = normalizeList(body.categories || body.category, 5).map((item) => item.toLowerCase());
    if (!categories.length) {
      throw { status: 400, message: "Select at least one news category" };
    }

    const orderedFiles = [...(files || [])].sort((a, b) => {
      if (isVideoFile(a) === isVideoFile(b)) return 0;
      return isVideoFile(a) ? -1 : 1;
    });

    const mediaFiles = [];
    for (const [index, file] of orderedFiles.entries()) {
      const isVideo = isVideoFile(file);
      const result = isVideo
        ? await cloudinaryService.uploadMedia(file.buffer, {
          folder: "nendplay/news/videos",
          resourceType: "video",
        })
        : await cloudinaryService.uploadThumbnail(file.buffer, {
          folder: "nendplay/news/images",
        });

      mediaFiles.push({
        type: isVideo ? "video" : "image",
        url: isVideo ? cloudinaryService.getStreamingUrl(result) : result.secure_url,
        publicId: result.public_id || "",
        mimeType: file.mimetype,
        size: file.size || result.bytes || 0,
        order: index,
      });
    }

    const post = await NewsPost.create({
      header: body.header || body.title,
      subHeader: body.subHeader || body.summary || "",
      body: body.body || body.text,
      categories,
      mediaFiles,
      adsEnabled: body.adsEnabled === undefined ? true : body.adsEnabled === true || body.adsEnabled === "true",
      status: body.status || "published",
      source: body.source || "NendPlay News",
      createdBy: adminId,
      updatedBy: adminId,
    });

    return toPublicNewsPost(await NewsPost.findById(post._id).lean());
  }

  async getNewsPost(id) {
    const post = await NewsPost.findById(id)
      .populate("comments.user", "username profileName profilePic role")
      .lean();
    if (!post || post.status !== "published") {
      throw { status: 404, message: "News post not found" };
    }
    return {
      ...toPublicNewsPost(post),
      comments: (post.comments || [])
        .filter((comment) => !comment.isHidden)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((comment) => ({
          _id: comment._id,
          text: comment.text,
          likeCount: comment.likeCount || 0,
          createdAt: comment.createdAt,
          user: comment.user,
        })),
    };
  }

  async addComment(newsId, userId, text) {
    const cleanText = String(text || "").trim();
    if (!cleanText) throw { status: 400, message: "Comment text is required" };

    const post = await NewsPost.findOne({ _id: newsId, status: "published" });
    if (!post) throw { status: 404, message: "News post not found" };

    post.comments.push({ user: userId, text: cleanText });
    post.commentCount = post.comments.filter((comment) => !comment.isHidden).length;
    await post.save();
    return this.getNewsPost(newsId);
  }

  async recordShare(newsId) {
    const post = await NewsPost.findOneAndUpdate(
      { _id: newsId, status: "published" },
      { $inc: { shareCount: 1 } },
      { new: true }
    ).lean();
    if (!post) throw { status: 404, message: "News post not found" };
    return { shareCount: post.shareCount || 0 };
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
