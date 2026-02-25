import axios from "axios";
import { expireSession, isSessionExpired, touchActivity } from "./session";
import { FALLBACK_BACKEND } from "../constants/api";

const ACCESS_TOKEN_KEY = "access_token";

const AUTH_401_DETAILS = new Set([
  "Could not validate credentials",
  "Invalid token",
  "Not authenticated",
]);

const shouldExpireSessionFor401 = (error) => {
  if (error?.response?.status !== 401) return false;

  const wwwAuthenticate = String(
    error?.response?.headers?.["www-authenticate"] || ""
  ).toLowerCase();
  if (wwwAuthenticate.includes("bearer")) return true;

  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && AUTH_401_DETAILS.has(detail.trim())) {
    return true;
  }
  return false;
};

const pickBaseURL = () => {
  // 우선순위: BACKEND_ORIGIN (http://13.209...) -> API_BASE (http://13.209.../api)
  const origin = (process.env.REACT_APP_BACKEND_ORIGIN || "").trim();
  const apiBase = (process.env.REACT_APP_API_BASE || "").trim();

  // 둘 다 없으면 fallback (개발/디버그)
  return origin || apiBase || FALLBACK_BACKEND;
};

const api = axios.create({
  baseURL: pickBaseURL(),     
  withCredentials: false,      
});

// ✅ 요청마다 Authorization 자동 추가
api.interceptors.request.use(
  (config) => {
    if (isSessionExpired()) {
      expireSession();
      return Promise.reject(new Error("Session expired"));
    }

    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers = config.headers || {};
      // 이미 Authorization이 있으면 덮어쓰지 않음
      if (!config.headers.Authorization && !config.headers.authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    touchActivity();
    return response;
  },
  (error) => {
    // ✅ 토큰이 있을 때만 401을 "세션 만료"로 처리(불필요한 강제 로그아웃 방지)
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (token && shouldExpireSessionFor401(error)) {
      expireSession();
    }
    return Promise.reject(error);
  }
);

export default api;