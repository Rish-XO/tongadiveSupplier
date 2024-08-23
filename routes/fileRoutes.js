const express = require("express");
const router = express.Router();
const fileController = require("../controllers/fileController");

// Define the routes
router.get("/generateSignedUrl", fileController.generateSignedUrl);
router.post("/processUploadedFile", fileController.processUploadedFile);

module.exports = router;
