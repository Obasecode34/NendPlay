const newsService = require("../services/news.service");
const ApiResponse = require("../utils/apiResponse");

class NewsController {
  async getDailyNews(req, res) {
    try {
      const { category, search, page, limit, tab, country, city, region } = req.query;
      const result = await newsService.getDailyNews({
        category,
        search,
        page,
        limit,
        tab,
        country,
        city,
        region,
      });

      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: 500,
        message: err.message || "Failed to load daily news",
      });
    }
  }
}

module.exports = new NewsController();
