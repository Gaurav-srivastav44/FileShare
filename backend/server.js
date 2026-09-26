import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

import File from "./models/File.js";
import Folder from "./models/Folder.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  "http://localhost:5173"
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-session-key"
    ]
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const sessions = new Map();

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
    maxAge: 1000 * 60 * 60 * 12
  };
}

function getSessionId(req) {
  return (
    req.cookies?.sessionId ||
    req.headers["x-session-key"] ||
    null
  );
}

function auth(req, res, next) {
  const sessionId = getSessionId(req);

  if (!sessionId) {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  if (!sessions.has(sessionId)) {
    return res.status(401).json({
      message: "Invalid session"
    });
  }

  req.sessionId = sessionId;

  next();
}

function normalizeFolderPath(value) {
  const raw = String(value || "/").trim();

  if (!raw || raw === "/") {
    return "/";
  }

  const cleaned = raw.replace(/^\/+|\/+$/g, "");

  return cleaned ? `/${cleaned}` : "/";
}

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    message: "Papa Files API is running"
  });
});

/* =========================
   AUTH
========================= */

app.post("/api/auth/verify", async (req, res) => {
  try {
    const submittedCode = String(
      req.body.code || ""
    ).trim();

    if (!submittedCode) {
      return res.status(400).json({
        message: "Secret code is required"
      });
    }

    if (submittedCode !== process.env.SECRET_CODE) {
      return res.status(401).json({
        message: "Invalid secret code"
      });
    }

    const sessionId = crypto.randomUUID();

    sessions.set(sessionId, {
      createdAt: Date.now()
    });

    res.cookie(
      "sessionId",
      sessionId,
      cookieOptions()
    );

    return res.json({
      message: "Authorized"
    });
  } catch (error) {
    console.error("Auth error:", error);

    return res.status(500).json({
      message: "Authentication failed"
    });
  }
});

app.get("/api/auth/check", auth, (req, res) => {
  res.json({
    ok: true
  });
});

app.post("/api/auth/logout", auth, (req, res) => {
  const sessionId = req.sessionId;

  sessions.delete(sessionId);

  res.clearCookie("sessionId", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/"
  });

  return res.json({
    message: "Logged out"
  });
});

/* =========================
   FOLDERS
========================= */

app.post("/api/folders", auth, async (req, res) => {
  try {
    const name = String(
      req.body.name || ""
    ).trim();

    const parentId =
      req.body.parentId || null;

    if (!name) {
      return res.status(400).json({
        message: "Folder name is required"
      });
    }

    const parent = parentId
      ? await Folder.findById(parentId)
      : null;

    if (parentId && !parent) {
      return res.status(404).json({
        message: "Parent folder not found"
      });
    }

    const parentPath = parent
      ? parent.path
      : "/";

    const folderPath =
      parentPath === "/"
        ? `/${name}`
        : `${parentPath}/${name}`;

    const folder = await Folder.create({
      name,
      parentId,
      path: folderPath
    });

    return res.status(201).json({
      folder
    });
  } catch (error) {
    console.error("Create folder error:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Could not create folder"
    });
  }
});

app.get("/api/folders", auth, async (req, res) => {
  try {
    const parentId =
      req.query.parentId || null;

    const folders = await Folder.find(
      parentId
        ? { parentId }
        : { parentId: null }
    ).sort({
      createdAt: 1
    });

    return res.json({
      folders
    });
  } catch (error) {
    console.error("Get folders error:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Could not load folders"
    });
  }
});

app.delete("/api/folders/:id", auth, async (req, res) => {
  try {
    const folder = await Folder.findById(
      req.params.id
    );

    if (!folder) {
      return res.status(404).json({
        message: "Folder not found"
      });
    }

    const childFolders = await Folder.find({
      parentId: folder._id
    });

    const childFiles = await File.find({
      folderId: folder._id
    });

    if (
      childFolders.length ||
      childFiles.length
    ) {
      return res.status(400).json({
        message: "Folder is not empty"
      });
    }

    await folder.deleteOne();

    return res.json({
      message: "Folder deleted"
    });
  } catch (error) {
    console.error("Delete folder error:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Could not delete folder"
    });
  }
});

/* =========================
   FILE UPLOAD
========================= */

app.post(
  "/api/files/upload",
  auth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded"
        });
      }

      const folderId =
        req.body.folderId || null;

      const folder = folderId
        ? await Folder.findById(folderId)
        : null;

      if (folderId && !folder) {
        return res.status(404).json({
          message: "Folder not found"
        });
      }

      const folderPath = folder
        ? folder.path
        : "/";

      const originalName =
        req.file.originalname || "file";

      const safeName = String(originalName)
        .replace(/\\/g, "/")
        .split("/")
        .pop();

      const storageName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${safeName}`;

      const objectPath =
        folderPath === "/"
          ? `uploads/${storageName}`
          : `uploads${folderPath}/${storageName}`;

      /* Upload to Supabase */

      const { error: supabaseError } =
        await supabase.storage
          .from(process.env.SUPABASE_BUCKET)
          .upload(
            objectPath,
            req.file.buffer,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                req.file.mimetype ||
                "application/octet-stream"
            }
          );

      if (supabaseError) {
        console.error(
          "Supabase upload error:",
          supabaseError
        );

        return res.status(500).json({
          message:
            supabaseError.message ||
            "Supabase upload failed"
        });
      }

      /* Save metadata to MongoDB */

      const fileRecord = await File.create({
        name: safeName,
        key: objectPath,
        originalName: safeName,
        storagePath: objectPath,
        mimeType:
          req.file.mimetype ||
          "application/octet-stream",
        size: req.file.size,
        folder:
          normalizeFolderPath(folderPath),
        folderId: folder
          ? folder._id
          : null
      });

      return res.status(201).json({
        file: fileRecord
      });
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Upload failed"
      });
    }
  }
);

/* =========================
   GET FILES + FOLDERS
========================= */

app.get("/api/files", auth, async (req, res) => {
  try {
    const parentFolderId =
      req.query.folderId || null;

    const files = await File.find(
      parentFolderId
        ? { folderId: parentFolderId }
        : { folderId: null }
    ).sort({
      createdAt: -1
    });

    const folders = await Folder.find(
      parentFolderId
        ? { parentId: parentFolderId }
        : { parentId: null }
    ).sort({
      createdAt: 1
    });

    return res.json({
      files,
      folders
    });
  } catch (error) {
    console.error(
      "Get files error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Could not load files"
    });
  }
});

/* =========================
   OPEN FILE
========================= */

app.get(
  "/api/files/:id",
  auth,
  async (req, res) => {
    try {
      const file = await File.findById(
        req.params.id
      );

      if (!file) {
        return res.status(404).json({
          message: "File not found"
        });
      }

      const {
        data,
        error
      } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .createSignedUrl(
          file.storagePath,
          60 * 60
        );

      if (error) {
        console.error(
          "Signed URL error:",
          error
        );

        return res.status(500).json({
          message:
            error.message ||
            "Could not generate signed URL"
        });
      }

      return res.json({
        file,
        signedUrl: data.signedUrl
      });
    } catch (error) {
      console.error(
        "Open file error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Could not open file"
      });
    }
  }
);

app.put(
  "/api/files/:id",
  auth,
  upload.single("file"),
  async (req, res) => {
    try {
      const fileDoc = await File.findById(req.params.id);

      if (!fileDoc) {
        return res.status(404).json({
          message: "File not found"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded"
        });
      }

      const folder = fileDoc.folderId
        ? await Folder.findById(fileDoc.folderId)
        : null;

      const originalName =
        req.file.originalname || fileDoc.originalName || "updated-file";

      const safeName = String(originalName)
        .replace(/\\/g, "/")
        .split("/")
        .pop();

      const folderPath = folder
        ? folder.path
        : "/";

      const objectPath =
        folderPath === "/"
          ? `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`
          : `uploads${folderPath}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;

      const { error: supabaseError } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(objectPath, req.file.buffer, {
          cacheControl: "3600",
          upsert: true,
          contentType: req.file.mimetype || "application/octet-stream"
        });

      if (supabaseError) {
        console.error("Supabase update upload error:", supabaseError);
        return res.status(500).json({
          message: supabaseError.message || "Could not save file"
        });
      }

      const previousStoragePath = fileDoc.storagePath;
      if (previousStoragePath && previousStoragePath !== objectPath) {
        await supabase.storage
          .from(process.env.SUPABASE_BUCKET)
          .remove([previousStoragePath]);
      }

      fileDoc.name = safeName;
      fileDoc.originalName = safeName;
      fileDoc.storagePath = objectPath;
      fileDoc.mimeType = req.file.mimetype || fileDoc.mimeType || "application/octet-stream";
      fileDoc.size = req.file.size || fileDoc.size || 0;
      fileDoc.folder = normalizeFolderPath(folderPath);
      fileDoc.folderId = folder ? folder._id : null;
      await fileDoc.save();

      return res.json({
        message: "File updated",
        file: fileDoc
      });
    } catch (error) {
      console.error("Update file error:", error);
      return res.status(500).json({
        message: error.message || "Update failed"
      });
    }
  }
);

/* =========================
   DELETE FILE
========================= */

app.delete(
  "/api/files/:id",
  auth,
  async (req, res) => {
    try {
      const file = await File.findById(
        req.params.id
      );

      if (!file) {
        return res.status(404).json({
          message: "File not found"
        });
      }

      const {
        error: deleteStorageError
      } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .remove([
          file.storagePath
        ]);

      if (deleteStorageError) {
        console.error(
          "Supabase delete error:",
          deleteStorageError
        );

        return res.status(500).json({
          message:
            deleteStorageError.message ||
            "Could not delete file from storage"
        });
      }

      await file.deleteOne();

      return res.json({
        message: "File deleted"
      });
    } catch (error) {
      console.error(
        "Delete file error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Delete failed"
      });
    }
  }
);

/* =========================
   ERROR HANDLER
========================= */

app.use((error, req, res, next) => {
  console.error(
    "Unhandled error:",
    error
  );

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message:
          "File size cannot exceed 50 MB"
      });
    }

    return res.status(400).json({
      message: error.message
    });
  }

  return res.status(500).json({
    message:
      error.message ||
      "Internal server error"
  });
});

/* =========================
   START SERVER
========================= */

async function start() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "MongoDB connected"
    );

    console.log(
      `Supabase bucket: ${process.env.SUPABASE_BUCKET}`
    );

    app.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Server startup error:",
      error.message
    );

    process.exit(1);
  }
}

start();