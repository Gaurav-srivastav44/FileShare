import mongoose from "mongoose";

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
  path: { type: String, default: "/" }
}, { timestamps: true });

export default mongoose.model("Folder", folderSchema);
