import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { fromPath } from "pdf2pic";
import Tesseract from "tesseract.js";

export const handlePdfUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;

    // Read file as bytes for PDF.js
    const data = new Uint8Array(fs.readFileSync(filePath));

    // Load PDF
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let extractedText = "";

    // DIGITAL TEXT EXTRACTION (PDF.js)
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items.map(item => item.str).join(" ");
      extractedText += pageText + "\n\n";
    }

    // DETECT SCANNED PDF
    const isScanned = extractedText.trim().length < 100;

    // ------------------------------------------------------------------------------------
    // OCR FALLBACK: HANDLE SCANNED PDF (ALL PAGES)
    // ------------------------------------------------------------------------------------
    if (isScanned) {
      console.log("📄 Scanned PDF detected → Running OCR on all pages...");

      let ocrText = "";

      // convert PDF → images
      const convert = fromPath(filePath, {
        density: 150,
        savePath: "./extracted",
        format: "png",
        width: 1200,
        height: 1600,
      });

      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`🖼️ Converting page ${i} to PNG...`);
        const result = await convert(i);
        const imagePath = result.path;

        console.log(`🔍 Running OCR on page ${i}...`);
        const { data } = await Tesseract.recognize(imagePath, "eng");

        ocrText += data.text + "\n\n";
      }

      extractedText = ocrText;
    }

    // ------------------------------------------------------------------------------------
    // SAVE FINAL TEXT
    // ------------------------------------------------------------------------------------
    if (!fs.existsSync("extracted")) {
      fs.mkdirSync("extracted");
    }

    const outputPath = "extracted/full_text.txt";
    fs.writeFileSync(outputPath, extractedText);

    res.json({
      message: isScanned
        ? "Scanned PDF extracted using OCR"
        : "Digital PDF extracted using PDF.js",
      pages: pdf.numPages,
      outputPath,
    });

  } catch (error) {
    console.error("❌ PDF extraction error:", error);
    res.status(500).json({
      message: "Server Error during extraction",
      error: error.toString(),
    });
  }
};
