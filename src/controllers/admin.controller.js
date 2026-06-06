const adminService = require("../services/admin.service");
const ApiResponse = require("../utils/apiResponse");

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err.status) return ApiResponse.error(res, { statusCode: err.status, message: err.message });
    console.error("Admin controller error:", err);
    return ApiResponse.error(res, { message: err.message || "Admin request failed" });
  }
};

class AdminController {
  getDashboard = wrap(async (req, res) => {
    const data = await adminService.getDashboard();
    return ApiResponse.success(res, { data });
  });

  getPermissions = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: { permissions: adminService.getPermissions() } });
  });

  listUsers = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: await adminService.listUsers(req.query) });
  });

  getUserDetails = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: await adminService.getUserDetails(req.params.id, req.admin) });
  });

  updateUser = wrap(async (req, res) => {
    const user = await adminService.updateUser(req.params.id, req.body, req.admin);
    return ApiResponse.success(res, { message: "User updated", data: { user } });
  });

  sendUserEmail = wrap(async (req, res) => {
    const result = await adminService.sendUserEmail(req.params.id, req.body, req.admin);
    return ApiResponse.success(res, { message: "Message sent to user email", data: result });
  });

  deleteUser = wrap(async (req, res) => {
    const result = await adminService.deleteUser(req.params.id, req.admin);
    return ApiResponse.success(res, { message: "User account deleted", data: result });
  });

  listMedia = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: await adminService.listMedia(req.query) });
  });

  updateMedia = wrap(async (req, res) => {
    const media = await adminService.updateMedia(req.params.id, req.body, req.admin);
    return ApiResponse.success(res, { message: "Media updated", data: { media } });
  });

  approveMedia = wrap(async (req, res) => {
    const media = await adminService.approveMedia(req.params.id, req.admin);
    return ApiResponse.success(res, { message: "Media approved", data: { media } });
  });

  rejectMedia = wrap(async (req, res) => {
    const media = await adminService.rejectMedia(req.params.id, req.body, req.admin);
    return ApiResponse.success(res, { message: "Media rejected", data: { media } });
  });

  deleteMedia = wrap(async (req, res) => {
    const result = await adminService.deleteMedia(req.params.id, req.admin);
    return ApiResponse.success(res, { message: "Media file deleted", data: result });
  });

  listDocuments = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: await adminService.listDocuments(req.query) });
  });

  updateDocument = wrap(async (req, res) => {
    const document = await adminService.updateDocument(req.params.id, req.body);
    return ApiResponse.success(res, { message: "Document updated", data: { document } });
  });

  deleteDocument = wrap(async (req, res) => {
    const result = await adminService.deleteDocument(req.params.id, req.admin);
    return ApiResponse.success(res, { message: "Document deleted", data: result });
  });

  listAds = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: await adminService.listAds(req.query) });
  });

  updateAd = wrap(async (req, res) => {
    const ad = await adminService.updateAd(req.params.id, req.body);
    return ApiResponse.success(res, { message: "Ad updated", data: { ad } });
  });

  listSubscriptions = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: await adminService.listSubscriptions(req.query) });
  });

  listDownloads = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: await adminService.listDownloads(req.query) });
  });

  listRewards = wrap(async (req, res) => {
    return ApiResponse.success(res, { data: await adminService.listRewards(req.query) });
  });
}

module.exports = new AdminController();
