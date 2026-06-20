const analyticsService = require("../services/analytics.service");
const ApiResponse = require("../utils/apiResponse");

class AnalyticsController {
  async track(req, res) {
    try {
      const data = await analyticsService.track({
        user: req.user,
        body: req.body,
        headers: req.headers,
      });
      return ApiResponse.created(res, { message: "Analytics event recorded", data });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Analytics tracking failed",
      });
    }
  }

  async adminSummary(req, res) {
    try {
      const data = await analyticsService.getAdminSummary();
      return ApiResponse.success(res, { data });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Analytics summary failed",
      });
    }
  }
}

module.exports = new AnalyticsController();
