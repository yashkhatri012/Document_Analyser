import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export const handlePdfUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;

    // 1) Read file as Uint8Array (required by PDF.js)
    const data = new Uint8Array(fs.readFileSync(filePath));

    // 2) Load the PDF
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let finalText = "";

    // 3) Loop through all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      // Extract the text
      const pageText = content.items.map(item => item.str).join(" ");
      finalText += pageText + "\n\n";
    }

    // 4) Ensure extracted folder exists
    if (!fs.existsSync("extracted")) {
      fs.mkdirSync("extracted");
    }

    // 5) Save text
    const outputPath = "extracted/full_text.txt";
    fs.writeFileSync(outputPath, finalText);

    res.json({
      message: "PDF extracted successfully via PDF.js",
      text: finalText,
      outputPath,
    });

  } catch (error) {
    console.error("PDF.js extraction error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};
