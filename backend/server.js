import express from "express";
import cors from "cors";
import pdfRouter from "./routes/pdfRouter.js";





const app = express();
app.use(cors());
app.use(express.json());


app.use("/pdf", pdfRouter);

app.listen(5000, () => console.log("Server running on port 5000"));
