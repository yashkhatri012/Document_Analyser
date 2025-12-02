import express from "express";
import multer from "multer";
import { handlePdfUpload } from "../controllers/pdfController.js";

const pdfRouter = express.Router();


const upload = multer({ dest: "uploads/" });

pdfRouter.post("/upload", upload.single("pdf"), handlePdfUpload);

export default pdfRouter;
