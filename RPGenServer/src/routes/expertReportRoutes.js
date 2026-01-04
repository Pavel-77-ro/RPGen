const express = require("express");
const { requireExpert } = require("../middleware/auth");
const {
  getMe,
  getCurrentReport,
  getReportByMonth,
  updateExpertPart,
} = require("../controllers/expertReportController");
const { downloadExpertReport } = require("../controllers/expertDownloadController");
const { listMyReports } = require("../controllers/expertReportController");
const { generateMonthlyDescription } = require("../controllers/aiController");


const router = express.Router();
router.use(requireExpert);

router.get("/me", getMe);
router.get("/reports/current", getCurrentReport);
router.get("/reports/:year/:month", getReportByMonth);
router.put("/reports/:year/:month", updateExpertPart);
router.get("/reports/:year/:month/download", downloadExpertReport);
router.get("/reports/mine", listMyReports);
router.post("/reports/:year/:month/ai-description", generateMonthlyDescription);


module.exports = router;
