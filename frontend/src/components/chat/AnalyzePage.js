import { useEffect, useState } from "react";
import { fetchWithSession } from "../../services/session";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import HourglassLoader from "../common/HourglassLoader";
import PlantSelectPage from "./PlantSelectPage";
import "./Survey.css";

const ORIGIN = process.env.REACT_APP_BACKEND_ORIGIN;
const ANALYZE_API = `${ORIGIN}/api/proxy/analyze`;

export default function AnalyzePage() {
  const nav = useNavigate();

  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setStatus("loading");
      setError("");

      // 1. 기존 데이터 정리
      try {
        sessionStorage.removeItem("selected_plant");
        sessionStorage.removeItem("ai_edit_url");
        sessionStorage.removeItem("render_result");
        sessionStorage.removeItem("last_render");
      } catch (e) {
        console.error("Session clear error:", e);
      }

      try {
        const meta = {
          lat: 37.5665,
          lot: 126.978,
          hhmm: new Date().toTimeString().slice(0, 5).replace(":", ""),
        };

        const filters = JSON.parse(sessionStorage.getItem("survey_answers") || "{}");
        console.log("[ANALYZE SEND]", { meta, filters });

        // ✅ 업로드 단계에서 저장해둔 값(필수)
        const sid = sessionStorage.getItem("sid") || localStorage.getItem("sid") || "";
        const bucket = sessionStorage.getItem("bucket") || "";
        const upload_key = sessionStorage.getItem("upload_key") || "";

        // ✅ 필수값 누락이면 즉시 중단 (Analyze가 S3에서 못 찾으면 HeadObject 404남)
        if (!sid || !bucket || !upload_key) {
          console.log("[ANALYZE][missing]", { sid, bucket, upload_key });
          throw new Error("missing_upload_context");
        }

        // ✅ /api/proxy/analyze가 요구하는 body 포맷 그대로
        const res = await fetchWithSession(ANALYZE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sid,
            bucket,
            upload_key,
            meta: {
              ...meta,
              scene_id: "etc_education_l_001",
            },
             filters: JSON.parse(sessionStorage.getItem("survey_answers") || "{}"),
            options: {},
          }),
        });

        if (!res.ok) throw new Error("analyze_failed");
        // await res.json(); 
        const data = await res.json();

        sessionStorage.setItem("analyze_result", JSON.stringify(data));
        if (data?.sid) localStorage.setItem("sid", data.sid);

        if (!alive) return;
        setStatus("done");
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setError("Failed to analyze space.");
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, []); 

  if (status === "loading") {
    return (
      <div className="surveyShell">
        <div className="surveyCard surveyCard--analyze surveyCard--loading">
          <HourglassLoader message="공간 분석 중..." />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="surveyShell">
        <div className="surveyCard surveyCard--analyze surveyCard--loading">
          <p className="surveyStatus surveyStatus--error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <PlantSelectPage
      onPicked={() => nav(ROUTES.RENDER)}
      onRetrySurvey={() => nav(ROUTES.SURVEY)}
    />

  );
}