import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../api";

export default function ExcelEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetName, setSheetName] = useState("");
  const [selectedCell, setSelectedCell] = useState("A1");
  const [formulaValue, setFormulaValue] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadWorkbook();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveWorkbook();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [workbook, file]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 2500);

    return () => clearTimeout(timer);
  }, [toast]);

  async function loadWorkbook() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(`/files/${id}`);

      if (!response.data?.signedUrl) {
        throw new Error("No workbook URL returned");
      }

      setFile(response.data.file);

      const fileResponse = await fetch(response.data.signedUrl);

      if (!fileResponse.ok) {
        throw new Error("Could not download workbook");
      }

      const arrayBuffer = await fileResponse.arrayBuffer();

      const workbookData = XLSX.read(arrayBuffer, {
        type: "array",
        cellFormula: true,
        cellStyles: true,
      });

      const firstSheet = workbookData.SheetNames[0];

      setWorkbook(workbookData);
      setSheetName(firstSheet || "Sheet1");

      setDirty(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not load spreadsheet"
      );
    } finally {
      setLoading(false);
    }
  }

  const sheetData = useMemo(() => {
    if (!workbook || !sheetName) return [];

    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) return [];

    return XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });
  }, [workbook, sheetName]);

  const maxColumns = Math.max(
    10,
    sheetData.reduce(
      (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
      0
    )
  );

  const maxRows = Math.max(30, sheetData.length);

  function columnLetter(index) {
    let result = "";
    let n = index + 1;

    while (n > 0) {
      const remainder = (n - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      n = Math.floor((n - 1) / 26);
    }

    return result;
  }

  function cellAddress(rowIndex, colIndex) {
    return `${columnLetter(colIndex)}${rowIndex + 1}`;
  }

  function getCellValue(address) {
    if (!workbook || !sheetName) return "";

    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) return "";

    const cell = worksheet[address];

    if (!cell) return "";

    if (cell.f) {
      return `=${cell.f}`;
    }

    return cell.v ?? "";
  }

  function selectCell(rowIndex, colIndex) {
    const address = cellAddress(rowIndex, colIndex);

    setSelectedCell(address);
    setFormulaValue(getCellValue(address));
  }

  function updateCell(rowIndex, colIndex, value) {
    if (!workbook || !sheetName) return;

    const worksheet = workbook.Sheets[sheetName];

    const address = cellAddress(rowIndex, colIndex);

    let cellValue = value;

    if (typeof value === "string" && value.startsWith("=")) {
      worksheet[address] = {
        ...worksheet[address],
        f: value.substring(1),
        v: "",
        t: "n",
      };
    } else {
      if (value === "") {
        delete worksheet[address];
      } else {
        const numberValue = Number(value);

        if (!Number.isNaN(numberValue) && value.trim() !== "") {
          cellValue = numberValue;
        }

        worksheet[address] = {
          ...worksheet[address],
          v: cellValue,
          t: typeof cellValue === "number" ? "n" : "s",
        };

        delete worksheet[address].f;
      }
    }

    setWorkbook({
      ...workbook,
      Sheets: {
        ...workbook.Sheets,
        [sheetName]: worksheet,
      },
    });

    setSelectedCell(address);
    setFormulaValue(value);
    setDirty(true);
  }

  function updateFormulaBar(value) {
    setFormulaValue(value);
    updateCellFromAddress(selectedCell, value);
  }

  function updateCellFromAddress(address, value) {
    if (!workbook || !sheetName) return;

    const worksheet = workbook.Sheets[sheetName];

    if (value === "") {
      delete worksheet[address];
    } else if (value.startsWith("=")) {
      worksheet[address] = {
        ...worksheet[address],
        f: value.substring(1),
        v: "",
        t: "n",
      };
    } else {
      const numberValue = Number(value);

      const finalValue =
        !Number.isNaN(numberValue) && value.trim() !== ""
          ? numberValue
          : value;

      worksheet[address] = {
        ...worksheet[address],
        v: finalValue,
        t: typeof finalValue === "number" ? "n" : "s",
      };

      delete worksheet[address].f;
    }

    setWorkbook({
      ...workbook,
      Sheets: {
        ...workbook.Sheets,
        [sheetName]: worksheet,
      },
    });

    setDirty(true);
  }

  function addRow() {
    if (!workbook || !sheetName) return;

    const worksheet = workbook.Sheets[sheetName];

    const currentRange = worksheet["!ref"]
      ? XLSX.utils.decode_range(worksheet["!ref"])
      : {
          s: { r: 0, c: 0 },
          e: { r: 0, c: 0 },
        };

    currentRange.e.r += 1;

    worksheet["!ref"] = XLSX.utils.encode_range(currentRange);

    setWorkbook({
      ...workbook,
      Sheets: {
        ...workbook.Sheets,
        [sheetName]: worksheet,
      },
    });

    setDirty(true);
    setToast("New row added");
  }

  function addColumn() {
    if (!workbook || !sheetName) return;

    const worksheet = workbook.Sheets[sheetName];

    const currentRange = worksheet["!ref"]
      ? XLSX.utils.decode_range(worksheet["!ref"])
      : {
          s: { r: 0, c: 0 },
          e: { r: 0, c: 0 },
        };

    currentRange.e.c += 1;

    worksheet["!ref"] = XLSX.utils.encode_range(currentRange);

    setWorkbook({
      ...workbook,
      Sheets: {
        ...workbook.Sheets,
        [sheetName]: worksheet,
      },
    });

    setDirty(true);
    setToast("New column added");
  }

  function addSheet() {
    if (!workbook) return;

    let counter = workbook.SheetNames.length + 1;
    let newSheetName = `Sheet${counter}`;

    while (workbook.SheetNames.includes(newSheetName)) {
      counter++;
      newSheetName = `Sheet${counter}`;
    }

    const newSheet = XLSX.utils.aoa_to_sheet([
      [""],
      [""],
      [""],
    ]);

    workbook.Sheets[newSheetName] = newSheet;
    workbook.SheetNames.push(newSheetName);

    setWorkbook({
      ...workbook,
      Sheets: {
        ...workbook.Sheets,
        [newSheetName]: newSheet,
      },
      SheetNames: [...workbook.SheetNames],
    });

    setSheetName(newSheetName);
    setDirty(true);
    setToast("New sheet added");
  }

  function renameSheet() {
    if (!workbook || !sheetName) return;

    const newName = window.prompt("Enter new sheet name:", sheetName);

    if (!newName || newName === sheetName) return;

    if (workbook.SheetNames.includes(newName)) {
      setToast("Sheet name already exists");
      return;
    }

    const worksheet = workbook.Sheets[sheetName];

    delete workbook.Sheets[sheetName];

    workbook.Sheets[newName] = worksheet;

    const index = workbook.SheetNames.indexOf(sheetName);

    workbook.SheetNames[index] = newName;

    setWorkbook({
      ...workbook,
      Sheets: {
        ...workbook.Sheets,
        [newName]: worksheet,
      },
      SheetNames: [...workbook.SheetNames],
    });

    setSheetName(newName);
    setDirty(true);
    setToast("Sheet renamed");
  }

  async function saveWorkbook() {
    if (!workbook || saving) return;

    try {
      setSaving(true);
      setError("");

      const workbookBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const fileBlob = new Blob([workbookBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const formData = new FormData();

      formData.append(
        "file",
        fileBlob,
        file?.originalName || file?.name || "workbook.xlsx"
      );

      await api.put(`/files/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setDirty(false);
      setToast("Changes saved successfully");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not save workbook"
      );
    } finally {
      setSaving(false);
    }
  }

  function downloadWorkbook() {
    if (!workbook) return;

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
      file?.originalName || file?.name || "workbook.xlsx";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    setToast("Workbook downloaded");
  }

  function handleBack() {
    if (dirty) {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Do you really want to leave?"
      );

      if (!confirmLeave) return;
    }

    navigate("/files");
  }

  function isSearchMatch(value) {
    if (!search) return false;

    return String(value ?? "")
      .toLowerCase()
      .includes(search.toLowerCase());
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />

          <p className="text-slate-700 font-medium">
            Loading spreadsheet...
          </p>
        </div>
      </div>
    );
  }

  if (error && !workbook) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <h2 className="text-xl font-bold text-slate-800 mb-3">
            Could not open spreadsheet
          </h2>

          <p className="text-red-600 mb-6">
            {error}
          </p>

          <button
            onClick={() => navigate("/files")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium"
          >
            Back to Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 shadow-sm">

        <div className="px-4 py-3 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3 min-w-0">

            <button
              onClick={handleBack}
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm font-medium"
            >
              ← Back
            </button>

            <div className="min-w-0">
              <h1 className="font-semibold text-lg truncate">
                {file?.originalName ||
                  file?.name ||
                  "Workbook"}
              </h1>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  {sheetName}
                </span>

                {dirty && (
                  <>
                    <span>•</span>
                    <span className="text-orange-600">
                      Unsaved changes
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <button
              onClick={downloadWorkbook}
              className="hidden sm:block px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm font-medium"
            >
              Download
            </button>

            <button
              onClick={saveWorkbook}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold shadow-sm"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>

          </div>

        </div>

        {/* TOOLBAR */}
        <div className="px-4 py-2 border-t border-slate-200 flex flex-wrap items-center gap-2">

          <button
            onClick={addRow}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-sm"
          >
            + Row
          </button>

          <button
            onClick={addColumn}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-sm"
          >
            + Column
          </button>

          <button
            onClick={addSheet}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-sm"
          >
            + Sheet
          </button>

          <button
            onClick={renameSheet}
            className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-sm"
          >
            Rename Sheet
          </button>

          <div className="ml-auto relative">

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workbook..."
              className="w-48 sm:w-64 px-3 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />

          </div>

        </div>

        {/* FORMULA BAR */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-2">

          <div className="w-16 sm:w-20 bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono text-center">
            {selectedCell}
          </div>

          <div className="text-slate-400 font-semibold">
            fx
          </div>

          <input
            value={formulaValue}
            onChange={(event) =>
              updateFormulaBar(event.target.value)
            }
            className="flex-1 min-w-0 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter value or formula..."
          />

        </div>

      </header>

      {/* ERROR */}
      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* EXCEL AREA */}
      <main className="flex-1 p-3 overflow-hidden">

        <div className="bg-white border border-slate-300 rounded-lg shadow-sm h-full flex flex-col overflow-hidden">

          {/* SHEET TABS */}

          <div className="flex items-center gap-1 px-2 pt-2 bg-slate-100 border-b border-slate-300 overflow-x-auto">

            {workbook?.SheetNames?.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setSheetName(name);
                  setSelectedCell("A1");
                  setFormulaValue("");
                }}
                className={`px-4 py-2 text-sm whitespace-nowrap rounded-t-lg border border-b-0 ${
                  sheetName === name
                    ? "bg-white border-slate-300 font-semibold text-blue-600"
                    : "bg-slate-200 border-transparent text-slate-600 hover:bg-slate-300"
                }`}
              >
                {name}
              </button>
            ))}

          </div>

          {/* SPREADSHEET */}

          <div className="flex-1 overflow-auto">

            <table className="border-collapse min-w-max">

              <thead className="sticky top-0 z-20">

                <tr>

                  <th className="sticky left-0 z-30 w-12 min-w-12 h-8 bg-slate-200 border border-slate-300 text-xs text-slate-500">
                    #
                  </th>

                  {Array.from({
                    length: maxColumns,
                  }).map((_, colIndex) => (
                    <th
                      key={colIndex}
                      className="w-32 min-w-32 h-8 bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-600"
                    >
                      {columnLetter(colIndex)}
                    </th>
                  ))}

                </tr>

              </thead>

              <tbody>

                {Array.from({
                  length: maxRows,
                }).map((_, rowIndex) => (

                  <tr key={rowIndex}>

                    <td className="sticky left-0 z-10 w-12 min-w-12 h-8 bg-slate-100 border border-slate-300 text-center text-xs text-slate-500 font-medium">
                      {rowIndex + 1}
                    </td>

                    {Array.from({
                      length: maxColumns,
                    }).map((_, colIndex) => {

                      const value =
                        sheetData[rowIndex]?.[colIndex] ??
                        "";

                      const address =
                        cellAddress(
                          rowIndex,
                          colIndex
                        );

                      const selected =
                        selectedCell === address;

                      const matched =
                        isSearchMatch(value);

                      return (
                        <td
                          key={colIndex}
                          onClick={() =>
                            selectCell(
                              rowIndex,
                              colIndex
                            )
                          }
                          className={`border border-slate-300 p-0 w-32 min-w-32 h-8 ${
                            matched
                              ? "bg-yellow-100"
                              : "bg-white"
                          } ${
                            selected
                              ? "ring-2 ring-inset ring-blue-500"
                              : ""
                          }`}
                        >

                          <input
                            type="text"
                            value={value}
                            onChange={(event) =>
                              updateCell(
                                rowIndex,
                                colIndex,
                                event.target.value
                              )
                            }
                            onFocus={() =>
                              selectCell(
                                rowIndex,
                                colIndex
                              )
                            }
                            className="w-full h-8 px-2 text-sm outline-none bg-transparent"
                          />

                        </td>
                      );
                    })}

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

          {/* STATUS BAR */}

          <div className="h-8 bg-slate-100 border-t border-slate-300 flex items-center justify-between px-3 text-xs text-slate-500">

            <div>
              {maxRows} rows × {maxColumns} columns
            </div>

            <div className="hidden sm:block">
              Ctrl + S to save
            </div>

          </div>

        </div>

      </main>

      {/* TOAST */}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">

          <div className="bg-slate-900 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3">

            <span className="text-green-400">
              ✓
            </span>

            <span className="text-sm font-medium">
              {toast}
            </span>

          </div>

        </div>
      )}

    </div>
  );
}