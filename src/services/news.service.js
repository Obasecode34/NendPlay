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

const NEWS_SECTIONS = ["news", "career", "unspoken"];
const JOB_MODES = ["on-site", "remote", "hybrid"];

function normalizeSection(value = "news") {
  const normalized = String(value || "news").trim().toLowerCase();
  return NEWS_SECTIONS.includes(normalized) ? normalized : "news";
}

function normalizeJobMode(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
  return JOB_MODES.includes(normalized) ? normalized : "";
}

function normalizeList(value, max = 5) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))].slice(0, max);
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeJobFields(body = {}) {
  return {
    company: normalizeText(body.company || body.source || "NendPlay Media"),
    tagline: normalizeText(body.tagline || "Empowering Jobs. Inspiring Futures."),
    location: normalizeText(body.location || body.jobLocation),
    salary: normalizeText(body.salary || body.salaryRange),
    experience: normalizeText(body.experience || body.yearsExperience),
    deadline: normalizeDate(body.deadline || body.applicationDeadline),
    jobType: normalizeText(body.jobType),
    level: normalizeText(body.level),
    urgency: normalizeText(body.urgency),
    applyEmail: normalizeText(body.applyEmail || body.contactEmail).toLowerCase(),
    applyUrl: normalizeText(body.applyUrl || body.applicationUrl),
    responsibilities: normalizeList(body.responsibilities, 12),
    requirements: normalizeList(body.requirements, 12),
    benefits: normalizeList(body.benefits, 8),
  };
}

function isVideoFile(file = {}) {
  return String(file.mimetype || "").startsWith("video/");
}

function isAudioFile(file = {}) {
  return String(file.mimetype || "").startsWith("audio/");
}

const NEWS_MEDIA_ORDER = { video: 0, audio: 1, image: 2 };

function assertNewsMediaLimits(files = [], existingMedia = []) {
  const existingVideos = existingMedia.filter((item) => item.type === "video").length;
  const existingAudio = existingMedia.filter((item) => item.type === "audio").length;
  const existingImages = existingMedia.filter((item) => item.type === "image").length;
  const incomingVideos = files.filter(isVideoFile).length;
  const incomingAudio = files.filter(isAudioFile).length;
  const incomingImages = files.length - incomingVideos - incomingAudio;

  if (existingVideos + incomingVideos > 5) {
    throw { status: 400, message: "A news post can include up to 5 videos" };
  }
  if (existingAudio + incomingAudio > 5) {
    throw { status: 400, message: "A news post can include up to 5 audio files" };
  }
  if (existingImages + incomingImages > 5) {
    throw { status: 400, message: "A news post can include up to 5 pictures" };
  }
}

function toPublicNewsPost(post) {
  const mediaFiles = [...(post.mediaFiles || [])].sort((a, b) => {
    if (a.type === b.type) return (a.order || 0) - (b.order || 0);
    return (NEWS_MEDIA_ORDER[a.type] ?? 99) - (NEWS_MEDIA_ORDER[b.type] ?? 99);
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
    section: normalizeSection(post.section),
    jobMode: normalizeJobMode(post.jobMode),
    company: post.company || post.source || "NendPlay News",
    tagline: post.tagline || "",
    location: post.location || "",
    salary: post.salary || "",
    experience: post.experience || "",
    deadline: post.deadline || null,
    jobType: post.jobType || "",
    level: post.level || "",
    urgency: post.urgency || "",
    applyEmail: post.applyEmail || "",
    applyUrl: post.applyUrl || "",
    responsibilities: post.responsibilities || [],
    requirements: post.requirements || [],
    benefits: post.benefits || [],
    categories: post.categories || [],
    category: post.categories?.[0] || "Top Stories",
    source: post.source || "NendPlay News",
    status: post.status || "published",
    createdBy: post.createdBy,
    imageUrl: firstImage?.url || firstVideo?.url || "",
    mediaFiles,
    url: "",
    publishedAt: post.createdAt,
    viewCount: post.viewCount || 0,
    commentCount: post.commentCount || 0,
    shareCount: post.shareCount || 0,
    likeCount: post.likeCount || 0,
    adsEnabled: post.adsEnabled !== false,
  };
}

function mapComment(comment) {
  const visibleReplies = (comment.replies || []).filter((reply) => !reply.isHidden);
  return {
    _id: comment._id,
    text: comment.text,
    likeCount: comment.likeCount || 0,
    createdAt: comment.createdAt,
    user: comment.user,
    replies: visibleReplies.map((reply) => ({
      _id: reply._id,
      text: reply.text,
      likeCount: reply.likeCount || 0,
      createdAt: reply.createdAt,
      user: reply.user,
    })),
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
  async uploadNewsFiles(files = [], existingMedia = []) {
    assertNewsMediaLimits(files, existingMedia);

    const orderedFiles = [...(files || [])].sort((a, b) => {
      const aType = isVideoFile(a) ? "video" : isAudioFile(a) ? "audio" : "image";
      const bType = isVideoFile(b) ? "video" : isAudioFile(b) ? "audio" : "image";
      return (NEWS_MEDIA_ORDER[aType] ?? 99) - (NEWS_MEDIA_ORDER[bType] ?? 99);
    });

    const mediaFiles = [];
    for (const [index, file] of orderedFiles.entries()) {
      const isVideo = isVideoFile(file);
      const isAudio = isAudioFile(file);
      const result = isVideo || isAudio
        ? await cloudinaryService.uploadMedia(file.buffer, {
          folder: isAudio ? "nendplay/news/audio" : "nendplay/news/videos",
          resourceType: "video",
        })
        : await cloudinaryService.uploadThumbnail(file.buffer, {
          folder: "nendplay/news/images",
        });

      mediaFiles.push({
        type: isVideo ? "video" : isAudio ? "audio" : "image",
        url: isVideo ? cloudinaryService.getStreamingUrl(result) : result.secure_url,
        publicId: result.public_id || "",
        mimeType: file.mimetype,
        size: file.size || result.bytes || 0,
        order: existingMedia.length + index,
      });
    }

    return mediaFiles;
  }

  async listInternalNews({
    category = "",
    search = "",
    tab = "for-you",
    section = "news",
    jobMode = "",
    page = 1,
    limit = 20,
    includeDrafts = false,
  } = {}) {
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const filter = includeDrafts ? {} : { status: "published" };
    const categoryKey = String(category || tab || "").trim().toLowerCase();
    const sectionKey = normalizeSection(section);
    const jobModeKey = normalizeJobMode(jobMode);

    if (sectionKey === "news") {
      filter.$or = [{ section: "news" }, { section: { $exists: false } }];
    } else {
      filter.section = sectionKey;
    }

    if (sectionKey === "career" && jobModeKey) {
      filter.jobMode = jobModeKey;
    }

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
    section = "news",
    jobMode = "",
    country = "",
    city = "",
    region = "",
    page = 1,
    limit = 20,
  }) {
    const newsApiKey = process.env.NEWS_API_KEY || "";
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const sectionKey = normalizeSection(section);
    const jobModeKey = normalizeJobMode(jobMode);
    const tabConfig = getTabConfig({ tab, category, country, city, region });
    const internal = await this.listInternalNews({
      category,
      search,
      tab,
      section: sectionKey,
      jobMode: jobModeKey,
      page: parsedPage,
      limit: parsedLimit,
    });

    if (sectionKey !== "news") {
      return {
        articles: internal.articles,
        source: "nendplay",
        tab,
        section: sectionKey,
        jobMode: jobModeKey,
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

    if (internal.articles.length >= parsedLimit || search) {
      return {
        articles: internal.articles,
        source: "nendplay",
        tab,
        section: sectionKey,
        jobMode: jobModeKey,
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
        section: sectionKey,
        country,
        city,
        region,
        page: parsedPage,
        limit: parsedLimit,
      });
      return {
        ...fallback,
        articles: [...internal.articles, ...fallback.articles].slice(0, parsedLimit),
        source: internal.articles.length ? "nendplay+fallback" : fallback.source,
        pagination: {
          ...fallback.pagination,
          total: internal.total + fallback.pagination.total,
          pages: Math.max(Math.ceil((internal.total + fallback.pagination.total) / parsedLimit), 1),
        },
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
      const total = (response.data.totalResults || articles.length) + internal.total;

      const merged = [...internal.articles, ...articles].slice(0, parsedLimit);

      return {
        articles: merged,
        source: internal.articles.length ? "nendplay+newsapi" : "newsapi",
        tab,
        section: sectionKey,
        jobMode: jobModeKey,
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
        section: sectionKey,
        country,
        city,
        region,
        page: parsedPage,
        limit: parsedLimit,
      });
      return {
        ...fallback,
        articles: [...internal.articles, ...fallback.articles].slice(0, parsedLimit),
        source: internal.articles.length ? "nendplay+fallback" : fallback.source,
        pagination: {
          ...fallback.pagination,
          total: internal.total + fallback.pagination.total,
          pages: Math.max(Math.ceil((internal.total + fallback.pagination.total) / parsedLimit), 1),
        },
      };
    }
  }

  async createNewsPost({ body = {}, files = [], adminId }) {
    const categories = normalizeList(body.categories || body.category, 5).map((item) => item.toLowerCase());
    if (!categories.length) {
      throw { status: 400, message: "Select at least one news category" };
    }

    const section = normalizeSection(body.section);
    const mediaFiles = await this.uploadNewsFiles(files, []);
    const jobFields = section === "career" ? normalizeJobFields(body) : {};

    const post = await NewsPost.create({
      header: body.header || body.title,
      subHeader: body.subHeader || body.summary || "",
      body: body.body || body.text,
      section,
      jobMode: section === "career" ? normalizeJobMode(body.jobMode) : "",
      ...jobFields,
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

  async updateNewsPost(id, { body = {}, files = [], adminId }) {
    const post = await NewsPost.findById(id);
    if (!post) throw { status: 404, message: "News post not found" };

    if (body.header !== undefined) post.header = body.header;
    if (body.subHeader !== undefined) post.subHeader = body.subHeader;
    if (body.body !== undefined) post.body = body.body;
    if (body.section !== undefined) post.section = normalizeSection(body.section);
    if (body.jobMode !== undefined || body.section !== undefined) {
      post.jobMode = normalizeSection(body.section !== undefined ? body.section : post.section) === "career"
        ? normalizeJobMode(body.jobMode || post.jobMode)
        : "";
    }
    const nextSection = normalizeSection(body.section !== undefined ? body.section : post.section);
    if (nextSection === "career") {
      Object.assign(post, normalizeJobFields({
        company: body.company !== undefined ? body.company : post.company,
        tagline: body.tagline !== undefined ? body.tagline : post.tagline,
        location: body.location !== undefined ? body.location : post.location,
        salary: body.salary !== undefined ? body.salary : post.salary,
        experience: body.experience !== undefined ? body.experience : post.experience,
        deadline: body.deadline !== undefined ? body.deadline : post.deadline,
        jobType: body.jobType !== undefined ? body.jobType : post.jobType,
        level: body.level !== undefined ? body.level : post.level,
        urgency: body.urgency !== undefined ? body.urgency : post.urgency,
        applyEmail: body.applyEmail !== undefined ? body.applyEmail : post.applyEmail,
        applyUrl: body.applyUrl !== undefined ? body.applyUrl : post.applyUrl,
        responsibilities: body.responsibilities !== undefined ? body.responsibilities : post.responsibilities,
        requirements: body.requirements !== undefined ? body.requirements : post.requirements,
        benefits: body.benefits !== undefined ? body.benefits : post.benefits,
      }));
    }
    if (body.categories !== undefined || body.category !== undefined) {
      const categories = normalizeList(body.categories || body.category, 5).map((item) => item.toLowerCase());
      if (!categories.length) throw { status: 400, message: "Select at least one news category" };
      post.categories = categories;
    }
    if (body.adsEnabled !== undefined) {
      post.adsEnabled = body.adsEnabled === true || body.adsEnabled === "true";
    }
    if (body.status !== undefined) post.status = body.status;
    if (body.source !== undefined) post.source = body.source || "NendPlay News";

    const incomingMedia = await this.uploadNewsFiles(files, post.mediaFiles || []);
    if (incomingMedia.length) {
      post.mediaFiles.push(...incomingMedia);
    }
    post.updatedBy = adminId;
    await post.save();
    return toPublicNewsPost(await NewsPost.findById(post._id).lean());
  }

  async deleteNewsPost(id) {
    const post = await NewsPost.findById(id);
    if (!post) throw { status: 404, message: "News post not found" };

    await Promise.all((post.mediaFiles || [])
      .filter((item) => item.publicId)
      .map((item) => cloudinaryService.deleteFile(item.publicId, item.type === "image" ? "image" : "video")));
    await post.deleteOne();
    return { deleted: true };
  }

  async getNewsPost(id) {
    const post = await NewsPost.findOneAndUpdate(
      { _id: id, status: "published" },
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate("comments.user", "username profileName profilePic role")
      .populate("comments.replies.user", "username profileName profilePic role")
      .lean();
    if (!post) {
      throw { status: 404, message: "News post not found" };
    }
    return {
      ...toPublicNewsPost(post),
      comments: (post.comments || [])
        .filter((comment) => !comment.isHidden)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(mapComment),
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

  async replyToComment(newsId, commentId, userId, text) {
    const cleanText = String(text || "").trim();
    if (!cleanText) throw { status: 400, message: "Reply text is required" };

    const post = await NewsPost.findOne({ _id: newsId, status: "published" });
    if (!post) throw { status: 404, message: "News post not found" };
    const comment = post.comments.id(commentId);
    if (!comment || comment.isHidden) throw { status: 404, message: "Comment not found" };

    comment.replies.push({ user: userId, text: cleanText });
    await post.save();
    return this.getNewsPost(newsId);
  }

  async toggleLike(newsId, userId) {
    const post = await NewsPost.findOne({ _id: newsId, status: "published" });
    if (!post) throw { status: 404, message: "News post not found" };
    const alreadyLiked = post.likedBy.some((id) => String(id) === String(userId));
    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter((id) => String(id) !== String(userId));
    } else {
      post.likedBy.push(userId);
    }
    post.likeCount = post.likedBy.length;
    await post.save();
    return { liked: !alreadyLiked, likeCount: post.likeCount };
  }

  async toggleCommentLike(newsId, commentId, userId) {
    const post = await NewsPost.findOne({ _id: newsId, status: "published" });
    if (!post) throw { status: 404, message: "News post not found" };
    const comment = post.comments.id(commentId);
    if (!comment || comment.isHidden) throw { status: 404, message: "Comment not found" };
    const alreadyLiked = comment.likedBy.some((id) => String(id) === String(userId));
    if (alreadyLiked) {
      comment.likedBy = comment.likedBy.filter((id) => String(id) !== String(userId));
    } else {
      comment.likedBy.push(userId);
    }
    comment.likeCount = comment.likedBy.length;
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
