import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithSession } from "../../services/session";
import { ROUTES } from "../../constants/routes"; 
import "./Survey.css"; // 기존스타일 재사용

const ORIGIN = process.env.REACT_APP_BACKEND_ORIGIN;

// ✅ 프론트 → API(9001) → CV(9000) 유지
// ✅ /api/chat/* 금지, /api/proxy/*로 통일
const UPLOAD_API = `${ORIGIN}/api/proxy/upload`;

export default function UploadPage() {
  const nav = useNavigate();

  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle|uploading|done|error
  const [uploadError, setUploadError] = useState("");

  const [needRoomType, setNeedRoomType] = useState(false);
  const [roomOptions, setRoomOptions] = useState(["거실", "침실", "주방", "욕실"]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    };
  }, [uploadPreviewUrl]);

  const handleUploadChange = (event) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadFiles(files);
    setUploadPreviewUrl(files[0] ? URL.createObjectURL(files[0]) : "");
    setUploadError("");
  };

  const doUploadToProxyUpload = async () => {
    if (uploadFiles.length === 0) throw new Error("no_file");

    const file = uploadFiles[0];
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(UPLOAD_API, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("upload_failed");
    return await res.json(); // { ok, sid, bucket, upload_key }
  };

  // ✅ 업로드 성공 시 공통 처리(플래그 저장 + 서버 응답 저장 + 페이지 이동)
  const finishAndGoSurvey = (serverPayload, chosenRoomType = "") => {
    // 1) Survey 강제 리다이렉트(Upload 안거치면 튕김) 방지 플래그
    sessionStorage.setItem("ditto_uploaded", "1");

    // 2) AnalyzePage 등 다음 페이지에서 쓸 수도 있으니 서버 응답 저장 (선택)
    //    (원치 않으면 이 2줄 지워도 됨)
    sessionStorage.setItem("ditto_upload_result", JSON.stringify(serverPayload ?? {}));
    if (chosenRoomType) sessionStorage.setItem("ditto_room_type", chosenRoomType);

    // 3) 파일/프리뷰 정리
    setUploadFiles([]);
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadPreviewUrl("");

    sessionStorage.setItem("ditto_uploaded", "1");

    // 4) Survey로 이동
    nav(ROUTES?.SURVEY || "/survey");
  };

  // const saveRoomImage = (serverPayload) => {
  //   const savedImage =
  //     serverPayload?.saved_image ||
  //     serverPayload?.data?.saved_image ||
  //     serverPayload?.payload?.saved_image ||
  //     null;
  //   if (!savedImage) return;

  //   const roomImageUrl = `${API_ROOT}/uploads/${savedImage}`;
  //   sessionStorage.setItem("room_image_url", roomImageUrl);
  //   sessionStorage.setItem("room_image_filename", savedImage);
  // };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (uploadFiles.length === 0 || uploadStatus === "uploading") return;

    setUploadStatus("uploading");
    setUploadError("");

    try {
      const data = await doUploadToProxyUpload();

      if (!data?.ok) throw new Error("upload_failed");

      // ✅ AnalyzePage에서 필요
      sessionStorage.setItem("sid", data.sid);
      sessionStorage.setItem("bucket", data.bucket);
      sessionStorage.setItem("upload_key", data.upload_key);

      // ✅ 업로드 게이트 통과 플래그
      sessionStorage.setItem("ditto_uploaded", "1");

      setNeedRoomType(false);
      setUploadStatus("done");
      nav(ROUTES?.SURVEY || "/survey");
    } catch (e) {
      setUploadStatus("idle");
      setUploadError("Failed to upload images.");
    }
  };

  const handlePickRoomType = async (rt) => {
    // 현재는 /api/proxy/upload → /api/proxy/analyze 흐름만 사용
    // room_type 분기(/api/chat/image 기반)는 사용하지 않으므로 비활성화
    // (UI가 뜨더라도 동작은 막아서 에러 방지)
    setNeedRoomType(false);
    setUploadError("");
    return;
  };

  return (
    <div className="surveyPage">
      <div className="surveyShell">
        <div className="surveyCard">
          <div className="surveyGate">
            <header className="surveyHeader">
              <h2 className="surveyTitle">방 사진을 업로드 해주세요</h2>
              <p className="surveyDesc">최적의 스팟을 추천해 드릴게요</p>
            </header>

            <form className="surveyUpload surveyUpload--gate" onSubmit={handleUploadSubmit}>
              <label className="surveyUpload__pick">
                <input
                  className="surveyUpload__input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadChange}
                />
                <span className="surveyUpload__text">
                  {uploadFiles.length ? `선택된 이미지 ${uploadFiles.length}개` : "이미지 업로드"}
                </span>
              </label>

              <button
                className="chatBtn"
                type="submit"
                disabled={uploadFiles.length === 0 || uploadStatus === "uploading"}
              >
                {uploadStatus === "uploading" ? "업로드 중.." : "업로드"}
              </button>
            </form>

            {uploadPreviewUrl && (
              <div className="surveyUploadPreview">
                <img className="surveyUploadPreview__img" src={uploadPreviewUrl} alt="preview" />
              </div>
            )}

            {uploadError && <p className="surveyStatus surveyStatus--error">{uploadError}</p>}

            {needRoomType && (
              <div style={{ marginTop: 12 }}>
                <p className="surveyDesc">사진에서 공간을 확정할 수 없어요. 공간을 선택해주세요.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {roomOptions.map((rt) => (
                    <button
                      key={rt}
                      type="button"
                      className="chatBtn"
                      onClick={() => handlePickRoomType(rt)}
                      disabled={uploadStatus === "uploading"}
                    >
                      {rt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
