
export const handlePdfUpload = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("PDF received:");
    console.log("filename:", req.file.originalname);
    console.log("stored at:", req.file.path);

    // now you can:
    // - read the pdf
    // - run detection (scanned vs digital)
    // - extract text

    return res.json({
      message: "PDF uploaded successfully",
      file: req.file,
    });

  } catch (error) {
    console.error("Error in controller:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

