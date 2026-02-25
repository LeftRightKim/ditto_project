import api from "./api";

const ACCESS_TOKEN_KEY = "access_token";

export const login = async (data) => {
  const res = await api.post("/api/auth/login", data);

  const token =
    res?.data?.access_token ??
    res?.data?.token ??
    res?.data?.accessToken ??
    null;

  if (token) localStorage.setItem("access_token", token);

  return res;
};

export const logout = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
};

export const register = (payload) => {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });

  return api.post("/api/auth/register", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const updateProfile = (payload) => {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });

  return api.put("/api/auth/profile", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
