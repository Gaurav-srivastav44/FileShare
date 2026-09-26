import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const sessionKey = localStorage.getItem("sessionKey");
  if (sessionKey) config.headers["x-session-key"] = sessionKey;
  return config;
});

export default api;
