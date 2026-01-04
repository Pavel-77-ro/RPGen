const express = require("express");
const { requireAdmin } = require("../middleware/auth");
const {
  listMonthReports,
  upsertPmPart,
  verifyReport,
} = require("../controllers/adminReportController");
const { downloadAdminReport } = require("../controllers/adminDownloadController");

const router = express.Router();
router.use(requireAdmin);

router.get("/", listMonthReports);
router.put("/:expertId/:year/:month/pm", upsertPmPart);
router.post("/:expertId/:year/:month/verify", verifyReport);
router.get("/:expertId/:year/:month/download", downloadAdminReport);

module.exports = router;
