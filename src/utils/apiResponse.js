// src/utils/apiResponse.js
//
// Every response from this API follows the same shape.
// Consistency is a feature. Frontend devs (including you on React/RN)
// will always know exactly what to expect.
//
// Success: { success: true,  message: "...", data: {...} }
// Error:   { success: false, message: "...", errors: [...] }

class ApiResponse {
  static success(res, { statusCode = 200, message = "Success", data = null } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(res, { statusCode = 500, message = "Something went wrong", errors = null } = {}) {
    const response = {
      success: false,
      message,
    };
    if (errors) response.errors = errors;
    return res.status(statusCode).json(response);
  }

  static created(res, { message = "Created successfully", data = null } = {}) {
    return ApiResponse.success(res, { statusCode: 201, message, data });
  }

  static unauthorized(res, message = "Unauthorized") {
    return ApiResponse.error(res, { statusCode: 401, message });
  }

  static forbidden(res, message = "Forbidden") {
    return ApiResponse.error(res, { statusCode: 403, message });
  }

  static notFound(res, message = "Not found") {
    return ApiResponse.error(res, { statusCode: 404, message });
  }

  static badRequest(res, message = "Bad request", errors = null) {
    return ApiResponse.error(res, { statusCode: 400, message, errors });
  }
}

module.exports = ApiResponse;
