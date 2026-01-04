const express = require("express");
const { adminLogin, expertLogin } = require("../controllers/authController");

const router = express.Router();

router.post("/admin", adminLogin);
router.post("/expert", expertLogin);

module.exports = router;
