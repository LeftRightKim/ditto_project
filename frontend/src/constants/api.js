export const BACKEND_ORIGIN = process.env.REACT_APP_BACKEND_ORIGIN;
export const CHAT_API_BASE = process.env.REACT_APP_API_BASE;

// ✅ 모든 API는 여기 하나로 통일
// export const API_ORIGIN = String(
  // process.env.REACT_APP_API_ORIGIN || "http://13.209.195.83:9001"
// ).replace(/\/+$/, "");

// ✅ 기존 코드 호환용
// export const FALLBACK_BACKEND = API_ORIGIN;

// ✅ 채팅도 무조건 같은 서버 기준으로
// export const FALLBACK_CHAT = `${API_ORIGIN}/api/chat`;

const ENV_API = process.env.REACT_APP_API_ORIGIN;

export const API_ORIGIN =
  ENV_API && ENV_API.trim() !== ""
    ? ENV_API.replace(/\/+$/, "")
    : "http://13.209.195.83:9001";

export const FALLBACK_BACKEND = API_ORIGIN;
export const FALLBACK_CHAT = `${API_ORIGIN}/api/chat`;