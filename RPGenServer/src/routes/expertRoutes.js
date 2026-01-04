const express = require("express");
const { requireAdmin } = require("../middleware/auth");
const { createExpert, listExperts, deleteExpert, updateExpertMonths } = require("../controllers/expertController");

const router = express.Router();

router.use(requireAdmin);

router.post("/", createExpert);
router.get("/", listExperts);
router.delete("/:id", deleteExpert);
router.put("/:id/months", updateExpertMonths);

module.exports = router;
