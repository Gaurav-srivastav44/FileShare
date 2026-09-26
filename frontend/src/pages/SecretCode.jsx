import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function SecretCode() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();

    if (!code.trim()) {
      setError("Please enter the secret code");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await api.post(
        "/auth/verify",
        { code },
        { withCredentials: true }
      );

      navigate("/files");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Incorrect secret code"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">

      <div className="w-full max-w-md">

        {/* CARD */}

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10"
        >

          {/* LOGO */}

          <div className="flex justify-center mb-6">

            <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-4xl shadow-lg">
              📁
            </div>

          </div>

          {/* TITLE */}

          <div className="text-center mb-8">

            <h1 className="text-3xl font-bold text-slate-800">
              Papa Files
            </h1>

            <p className="text-slate-500 mt-2 text-sm">
              Your personal file storage
            </p>

          </div>

          {/* SECRET CODE */}

          <div className="mb-5">

            <label
              htmlFor="secretCode"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Secret Code
            </label>

            <input
              id="secretCode"
              type="password"
              placeholder="Enter your secret code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              autoFocus
              disabled={loading}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 transition"
            />

          </div>

          {/* ERROR */}

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">

              <span>
                ⚠️
              </span>

              <span>
                {error}
              </span>

            </div>
          )}

          {/* BUTTON */}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold transition shadow-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">

                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />

                Verifying...

              </span>
            ) : (
              "Open Files →"
            )}
          </button>

          {/* FOOTER */}

          <p className="text-center text-xs text-slate-400 mt-6">
            🔒 Private file storage
          </p>

        </form>

      </div>

    </div>
  );
}