const express = require("express");
const { requireAdmin } = require("../middleware/auth");
const {
  listMonthReports,
  upsertPmPart,
  verifyReport,
} = require("../controllers/adminReportController");
const {
  downloadAdminReport,
  downloadAdminNarratives,
  downloadAdminAnexa13,
} = require("../controllers/adminDownloadController");

const router = express.Router();
router.use(requireAdmin);

router.get("/", listMonthReports);
router.put("/:expertId/:year/:month/pm", upsertPmPart);
router.post("/:expertId/:year/:month/verify", verifyReport);
router.get("/:year/:month/narratives/download", downloadAdminNarratives);
router.get("/:year/:month/anexa13/download", downloadAdminAnexa13);
router.get("/:expertId/:year/:month/download", downloadAdminReport);

module.exports = router;
