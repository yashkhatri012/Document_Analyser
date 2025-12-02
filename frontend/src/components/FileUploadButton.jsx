import { useRef, useState } from "react";
import axios from "axios";

export default function FileUploadButton() {
  const fileRef = useRef();
  const [file, setFile] = useState(null);

  const openPicker = () => {
    fileRef.current.click();
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("No file selected");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", file); // same key name as Multer

    try {
      const res = await axios.post(
        "http://localhost:5000/pdf/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Server Response:", res.data);
    } catch (error) {
      console.error("Upload Error:", error);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={openPicker}
        className="border border-gray-300 bg-white px-4 py-2 rounded-md hover:bg-gray-100 text-sm"
      >
        Select PDF
      </button>

      <input
        type="file"
        accept="application/pdf"
        ref={fileRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {file && (
        <p className="text-sm text-gray-600">
          Selected: <span className="font-medium">{file.name}</span>
        </p>
      )}

      <button
        onClick={handleUpload}
        className="border border-gray-300 bg-white px-4 py-2 rounded-md hover:bg-gray-100 text-sm"
      >
        Upload to Backend
      </button>
    </div>
  );
}
