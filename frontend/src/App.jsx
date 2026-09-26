import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SecretCode from "./pages/SecretCode";
import Files from "./pages/Files";
import FileViewer from "./components/FileViewer";
import ExcelEditor from "./components/ExcelEditor";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SecretCode />} />
      <Route path="/files" element={<Files />} />
      <Route path="/files/view/:id" element={<FileViewer />} />
      <Route path="/files/excel/:id" element={<ExcelEditor />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}