import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

function getFileExtension(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

function isImageFile(name = "") {
  const ext = getFileExtension(name);

  return [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "bmp",
    "webp",
    "svg",
  ].includes(ext);
}

function isPdfFile(name = "") {
  return getFileExtension(name) === "pdf";
}

function isOfficeDocument(name = "") {
  const ext = getFileExtension(name);

  return [
    "doc",
    "docx",
    "ppt",
    "pptx",
    "rtf",
    "txt",
    "html",
    "htm",
  ].includes(ext);
}

function isExcelFile(name = "") {
  const ext = getFileExtension(name);

  return ["xls", "xlsx", "csv"].includes(ext);
}

export default function FileViewer() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [signedUrl, setSignedUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadFile() {
      try {
        setLoading(true);
        setError("");

        const { data } = await api.get(`/files/${id}`);

        setSignedUrl(data?.signedUrl || "");

        if (data?.file) {
          setFile(data.file);
        } else {
          const fileResponse = await api.get("/files");

          const allFiles = fileResponse.data?.files || [];

          const foundFile = allFiles.find(
            (item) => item._id === id
          );

          setFile(
            foundFile || {
              originalName: "File",
              name: "File",
            }
          );
        }
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Could not load file"
        );
      } finally {
        setLoading(false);
      }
    }

    loadFile();
  }, [id]);

  useEffect(() => {
    if (!file) return;

    const fileName = (
      file.originalName ||
      file.name ||
      ""
    ).toLowerCase();

    if (isExcelFile(fileName)) {
      navigate(`/files/excel/${id}`, {
        replace: true,
      });
    }
  }, [file, id, navigate]);

  async function downloadCurrent() {
    if (!signedUrl || downloading) return;

    try {
      setDownloading(true);

      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download =
        file?.originalName ||
        file?.name ||
        "download";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err.message || "Could not download file"
      );
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">

        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">

          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />

          <p className="text-slate-700 font-medium">
            Loading file...
          </p>

        </div>

      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">

        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">

          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl mb-4">
            !
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Could not open file
          </h2>

          <p className="text-red-600 text-sm mb-6">
            {error}
          </p>

          <button
            type="button"
            onClick={() => navigate("/files")}
            className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
          >
            Back to Files
          </button>

        </div>

      </div>
    );
  }

  const fileName =
    file?.originalName ||
    file?.name ||
    "file";

  const lowerName = fileName.toLowerCase();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* HEADER */}

      <header className="bg-white border-b border-slate-200 shadow-sm">

        <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">

          {/* LEFT */}

          <div className="flex items-center gap-3 min-w-0">

            <button
              type="button"
              onClick={() => navigate("/files")}
              className="shrink-0 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium transition"
            >
              ← Back
            </button>

            <div className="min-w-0">

              <h1 className="text-lg sm:text-xl font-semibold text-slate-800 truncate">
                {fileName}
              </h1>

              <p className="text-xs text-slate-500 mt-0.5">
                File Viewer
              </p>

            </div>

          </div>

          {/* RIGHT */}

          <button
            type="button"
            onClick={downloadCurrent}
            disabled={downloading}
            className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold transition"
          >
            {downloading
              ? "Downloading..."
              : "Download"}
          </button>

        </div>

      </header>

      {/* VIEWER */}

      <main className="flex-1 p-3 sm:p-5">

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[calc(100vh-120px)]">

          {/* PDF */}

          {isPdfFile(lowerName) && (
            <iframe
              className="w-full h-[calc(100vh-120px)] border-0"
              src={signedUrl}
              title={fileName}
            />
          )}

          {/* IMAGE */}

          {isImageFile(lowerName) && (
            <div className="w-full min-h-[calc(100vh-120px)] bg-slate-100 flex items-center justify-center p-4 sm:p-8 overflow-auto">

              <img
                src={signedUrl}
                alt={fileName}
                className="max-w-full max-h-[calc(100vh-170px)] object-contain rounded-lg shadow-md"
              />

            </div>
          )}

          {/* OFFICE DOCUMENT */}

          {isOfficeDocument(lowerName) && (
            <iframe
              className="w-full h-[calc(100vh-120px)] border-0"
              src={signedUrl}
              title={fileName}
            />
          )}

          {/* FALLBACK */}

          {!isPdfFile(lowerName) &&
            !isImageFile(lowerName) &&
            !isOfficeDocument(lowerName) &&
            !isExcelFile(lowerName) && (
              <div className="min-h-[calc(100vh-120px)] flex items-center justify-center p-6">

                <div className="text-center max-w-md">

                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl">
                    📄
                  </div>

                  <h2 className="text-xl font-semibold text-slate-800 mb-2">
                    Preview not available
                  </h2>

                  <p className="text-slate-500 text-sm mb-6">
                    This file type cannot be previewed
                    directly in the browser.
                  </p>

                  <button
                    type="button"
                    onClick={downloadCurrent}
                    disabled={downloading}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium transition"
                  >
                    {downloading
                      ? "Downloading..."
                      : "Download File"}
                  </button>

                </div>

              </div>
            )}

        </div>

      </main>

    </div>
  );
}