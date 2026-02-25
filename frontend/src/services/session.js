// (파일 상단에 추가) API 오리진 결정을 위해 import 추가
import { FALLBACK_BACKEND } from "../constants/api";

const ACCESS_TOKEN_KEY = "access_token";

const STORAGE_KEY_USER = "user";
const STORAGE_KEY_LAST_ACTIVITY = "lastActivity";

export const IDLE_TIMEOUT_MS = 600 * 600 * 1000;
export const SESSION_EXPIRED_EVENT = "session-expired";

const readLastActivity = () => {
  const raw = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : null;
};

export const touchActivity = () => {
  localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(Date.now()));
};

export const isSessionExpired = (now = Date.now()) => {
  const last = readLastActivity();
  if (!last) return false;
  return now - last > IDLE_TIMEOUT_MS;
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY_USER);
  localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
};

export const expireSession = () => {
  clearSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
};

export const storeUser = (user) => {
  if (!user || typeof user !== "object") return;
  const { accessToken, ...rest } = user;
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(rest));
  touchActivity();
};

export const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user) return null;

    if (user?.accessToken) {
      delete user.accessToken;
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    }


    const last = readLastActivity();
    if (!last) {
      touchActivity();
      return user;
    }

    if (isSessionExpired()) {
      expireSession();
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
};

// /api/... 같은 상대경로를 API 서버 절대 URL로 변환
const pickApiOrigin = () => {
  const origin = (process.env.REACT_APP_BACKEND_ORIGIN || "").trim();
  const apiBase = (process.env.REACT_APP_API_BASE || "").trim();

  // 우리 코드가 "/api/..." 형태로 경로를 이미 붙여 쓰는 구조라
  // base는 "http://13.209.195.83:9001" 처럼 /api 없는 형태가 안전
  const base = origin || apiBase || FALLBACK_BACKEND;
  return String(base).replace(/\/+$/, ""); // 끝 슬래시 제거
};

const toAbsoluteUrl = (input) => {
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) return input; // 이미 절대 URL
    if (input.startsWith("/")) return `${pickApiOrigin()}${input}`; // "/api/..." → "http://.../api/..."
    return `${pickApiOrigin()}/${input}`; // "api/..." 같은 경우
  }

  // Request 객체면 url만 교체해서 새 Request로 생성
  if (input instanceof Request) {
    const url = input.url;
    if (/^https?:\/\//i.test(url)) return input;
    const abs = url.startsWith("/")
      ? `${pickApiOrigin()}${url}`
      : `${pickApiOrigin()}/${url}`;
    return new Request(abs, input);
  }

  return input;
};

export const fetchWithSession = async (input, init = {}) => {
  if (isSessionExpired()) {
    expireSession();
    throw new Error("Session expired");
  }

  const headers = new Headers(init.headers || {});

  // ✅ 토큰 자동 첨부 (Bearer)
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const nextInit = {
    ...init,
    headers,
    credentials: "omit",
  };

  const absInput = toAbsoluteUrl(input);
  const response = await fetch(absInput, nextInit);

  if (response.ok) {
    touchActivity();
  } else if (response.status === 401) {
    // 토큰이 있는데 401이면 만료 처리
    if (token) expireSession();
  }

  return response;
};