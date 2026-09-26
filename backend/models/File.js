import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    key: {
      type: String,
      required: true
    },

    originalName: {
      type: String,
      required: true
    },

    storagePath: {
      type: String,
      required: true
    },

    mimeType: {
      type: String,
      default: "application/octet-stream"
    },

    size: {
      type: Number,
      default: 0
    },

    folder: {
      type: String,
      default: "/"
    },

    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("File", fileSchema);