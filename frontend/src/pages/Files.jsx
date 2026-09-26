import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

function normalizeFolder(value) {
  const raw = String(value || "/").trim();

  if (!raw || raw === "/") return "/";

  const cleaned = raw.replace(/^\/+|\/+$/g, "");

  return cleaned ? `/${cleaned}` : "/";
}

function getFileExtension(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

function getFileIcon(name = "") {
  const ext = getFileExtension(name);

  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return "🖼️";
  }

  if (["xls", "xlsx", "csv"].includes(ext)) {
    return "📊";
  }

  if (["doc", "docx"].includes(ext)) {
    return "📝";
  }

  if (["ppt", "pptx"].includes(ext)) {
    return "📽️";
  }

  if (ext === "pdf") {
    return "📕";
  }

  if (["zip", "rar", "7z"].includes(ext)) {
    return "🗜️";
  }

  if (["mp4", "mkv", "avi", "mov"].includes(ext)) {
    return "🎬";
  }

  if (["mp3", "wav"].includes(ext)) {
    return "🎵";
  }

  return "📄";
}

function formatFileSize(size) {
  if (!size) return "";

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function Files() {
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);

  const [error, setError] = useState("");

  const [folderId, setFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState("/");

  const [newFolderName, setNewFolderName] = useState("");

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const navigate = useNavigate();

  async function loadFolders() {
    try {
      const response = await api.get("/folders", {
        params: {
          parentId: folderId || null,
        },
      });

      setFolders(response.data.folders || []);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/");
        return;
      }

      setError(
        err.response?.data?.message ||
          "Could not load folders"
      );
    }
  }

  async function loadFiles() {
    try {
      const response = await api.get("/files", {
        params: {
          folderId: folderId || null,
        },
      });

      setFiles(response.data.files || []);

      setError("");
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/");
        return;
      }

      setError(
        err.response?.data?.message ||
          "Could not load files"
      );
    }
  }

  async function loadData() {
    try {
      setLoading(true);

      await Promise.all([
        loadFolders(),
        loadFiles(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [folderId]);

  async function createFolder() {
    const name = newFolderName.trim();

    if (!name) {
      setError("Please enter a folder name");
      return;
    }

    try {
      setError("");

      await api.post("/folders", {
        name,
        parentId: folderId || null,
      });

      setNewFolderName("");

      await loadFolders();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not create folder"
      );
    }
  }

  async function handleUpload(event) {
    const fileToUpload =
      event.target.files?.[0];

    if (!fileToUpload) return;

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();

      formData.append("file", fileToUpload);

      if (folderId) {
        formData.append("folderId", folderId);
      }

      await api.post(
        "/files/upload",
        formData,
        {
          withCredentials: true,
        }
      );

      event.target.value = "";

      await loadFiles();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  }

  function openFile(file) {
    const fileName = (
      file.originalName ||
      file.name ||
      ""
    ).toLowerCase();

    const extension = getFileExtension(fileName);

    const isExcel = [
      "xls",
      "xlsx",
      "csv",
    ].includes(extension);

    const targetRoute = isExcel
      ? `/files/excel/${file._id}`
      : `/files/view/${file._id}`;

    navigate(targetRoute);
  }

  async function downloadFile(file) {
    try {
      setDownloadingId(file._id);
      setError("");

      const { data } = await api.get(
        `/files/${file._id}`
      );

      if (!data?.signedUrl) {
        throw new Error(
          "Download URL not available"
        );
      }

      const response = await fetch(
        data.signedUrl
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        file.originalName ||
        file.name ||
        "download";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not download file"
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function deleteFile(fileId) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this file?"
    );

    if (!confirmDelete) return;

    try {
      setDeletingId(fileId);
      setError("");

      await api.delete(
        `/files/${fileId}`
      );

      await loadFiles();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not delete file"
      );
    } finally {
      setDeletingId(null);
    }
  }

  function logout() {
    document.cookie =
      "sessionId=; Max-Age=0; path=/; SameSite=Lax";

    navigate("/");
  }

  function enterFolder(folder) {
    setFolderId(folder._id);

    setFolderPath(
      normalizeFolder(
        `${folderPath}/${folder.name}`
      )
    );
  }

  function goHome() {
    setFolderId(null);
    setFolderPath("/");
  }

  function handleFolderInputKeyDown(event) {
    if (event.key === "Enter") {
      createFolder();
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">

      {/* HEADER */}

      <header className="bg-white border-b border-slate-200 shadow-sm">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

          <div className="flex items-center justify-between gap-4">

            {/* LOGO */}

            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-2xl shadow-sm">
                📁
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Papa Files
                </h1>

                <p className="text-xs sm:text-sm text-slate-500">
                  Your personal file storage
                </p>
              </div>

            </div>

            {/* LOGOUT */}

            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm font-medium text-slate-700 transition"
            >
              Logout
            </button>

          </div>

        </div>

      </header>

      {/* MAIN */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* TOOLBAR */}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-5">

          <div className="flex flex-col lg:flex-row gap-3">

            {/* UPLOAD */}

            <label
              className={`cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition ${
                uploading
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >

              <span>
                {uploading ? "⏳" : "⬆️"}
              </span>

              <span>
                {uploading
                  ? "Uploading..."
                  : "Upload File"}
              </span>

              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />

            </label>

            {/* CREATE FOLDER */}

            <div className="flex flex-1 gap-2">

              <input
                type="text"
                value={newFolderName}
                placeholder="New folder name"
                onChange={(event) =>
                  setNewFolderName(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleFolderInputKeyDown
                }
                className="flex-1 min-w-0 px-4 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              <button
                type="button"
                onClick={createFolder}
                className="px-4 sm:px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition whitespace-nowrap"
              >
                + New Folder
              </button>

            </div>

          </div>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-start gap-3">

            <span className="text-lg">
              ⚠️
            </span>

            <p className="text-sm">
              {error}
            </p>

            <button
              type="button"
              onClick={() => setError("")}
              className="ml-auto text-red-500 hover:text-red-700 font-bold"
            >
              ×
            </button>

          </div>
        )}

        {/* BREADCRUMBS */}

        <div className="flex items-center gap-2 mb-5 text-sm overflow-x-auto">

          <button
            type="button"
            onClick={goHome}
            className={`font-medium whitespace-nowrap ${
              folderPath === "/"
                ? "text-blue-600"
                : "text-slate-600 hover:text-blue-600"
            }`}
          >
            🏠 Home
          </button>

          {folderPath !== "/" && (
            <>
              <span className="text-slate-400">
                /
              </span>

              <span className="text-slate-600 whitespace-nowrap">
                {folderPath
                  .replace(/^\/+/, "")
                  .split("/")
                  .filter(Boolean)
                  .join(" / ")}
              </span>
            </>
          )}

        </div>

        {/* LOADING */}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">

            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />

            <p className="text-slate-500">
              Loading files...
            </p>

          </div>
        ) : (
          <>
            {/* FOLDERS */}

            {folders.length > 0 && (
              <section className="mb-7">

                <div className="flex items-center justify-between mb-3">

                  <h2 className="text-lg font-semibold text-slate-800">
                    Folders
                  </h2>

                  <span className="text-sm text-slate-500">
                    {folders.length}{" "}
                    {folders.length === 1
                      ? "folder"
                      : "folders"}
                  </span>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">

                  {folders.map((folder) => (
                    <button
                      key={folder._id}
                      type="button"
                      onClick={() =>
                        enterFolder(folder)
                      }
                      className="group bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-md transition"
                    >

                      <div className="flex items-center gap-3">

                        <div className="w-11 h-11 rounded-lg bg-yellow-50 flex items-center justify-center text-2xl">
                          📁
                        </div>

                        <div className="min-w-0">

                          <p className="font-semibold text-slate-800 truncate group-hover:text-blue-600">
                            {folder.name}
                          </p>

                          <p className="text-xs text-slate-400 mt-1">
                            Open folder →
                          </p>

                        </div>

                      </div>

                    </button>
                  ))}

                </div>

              </section>
            )}

            {/* FILES */}

            {files.length > 0 && (
              <section>

                <div className="flex items-center justify-between mb-3">

                  <h2 className="text-lg font-semibold text-slate-800">
                    Files
                  </h2>

                  <span className="text-sm text-slate-500">
                    {files.length}{" "}
                    {files.length === 1
                      ? "file"
                      : "files"}
                  </span>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

                  {files.map((file) => (

                    <div
                      key={file._id}
                      className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-slate-300 transition"
                    >

                      {/* FILE ICON */}

                      <div className="flex items-start justify-between gap-3">

                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                          {getFileIcon(
                            file.originalName ||
                              file.name
                          )}
                        </div>

                        <span className="text-xs text-slate-400 uppercase">
                          {getFileExtension(
                            file.originalName ||
                              file.name
                          )}
                        </span>

                      </div>

                      {/* FILE NAME */}

                      <div className="mt-4">

                        <h3
                          className="font-semibold text-slate-800 truncate"
                          title={
                            file.originalName ||
                            file.name
                          }
                        >
                          {file.originalName ||
                            file.name}
                        </h3>

                        {file.size && (
                          <p className="text-xs text-slate-400 mt-1">
                            {formatFileSize(
                              file.size
                            )}
                          </p>
                        )}

                      </div>

                      {/* ACTIONS */}

                      <div className="grid grid-cols-2 gap-2 mt-4">

                        <button
                          type="button"
                          onClick={() =>
                            openFile(file)
                          }
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
                        >
                          Open
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            downloadFile(file)
                          }
                          disabled={
                            downloadingId ===
                            file._id
                          }
                          className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium transition"
                        >
                          {downloadingId ===
                          file._id
                            ? "..."
                            : "Download"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteFile(file._id)
                          }
                          disabled={
                            deletingId === file._id
                          }
                          className="col-span-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 text-sm font-medium transition"
                        >
                          {deletingId === file._id
                            ? "Deleting..."
                            : "🗑️ Delete"}
                        </button>

                      </div>

                    </div>

                  ))}

                </div>

              </section>
            )}

            {/* EMPTY STATE */}

            {!folders.length &&
              !files.length && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center">

                  <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-5">
                    📂
                  </div>

                  <h2 className="text-xl font-semibold text-slate-800 mb-2">
                    This folder is empty
                  </h2>

                  <p className="text-slate-500 text-sm mb-6">
                    Upload a file or create a
                    new folder to get started.
                  </p>

                  <div className="flex flex-col sm:flex-row justify-center gap-3">

                    <label className="cursor-pointer px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition">
                      ⬆️ Upload File

                      <input
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        document
                          .querySelector(
                            'input[placeholder="New folder name"]'
                          )
                          ?.focus()
                      }
                      className="px-5 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition"
                    >
                      + New Folder
                    </button>

                  </div>

                </div>
              )}
          </>
        )}

      </main>

    </div>
  );
}