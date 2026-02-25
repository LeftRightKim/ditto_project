import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import DiaryMainPage from "./DiaryMainPage";
import TimeLogPage from "./TimeLogPage";
import "./PlantBoard.css";
import DecorateContainer from "../../components/decorate/DecorateContainer";
import DiaryMiniPreview from "../../components/diary/DiaryMiniPreview";
import { fetchWithSession } from "../../services/session";
import iconTt from "../../assets/tamagotchi/plant_icons/튼튼이.png";
import iconStar from "../../assets/tamagotchi/plant_icons/별꽃이.png";
import iconLong from "../../assets/tamagotchi/plant_icons/쭉쭉이.png";
import iconFluffy from "../../assets/tamagotchi/plant_icons/복실이.png";
import iconVine from "../../assets/tamagotchi/plant_icons/꼬불이.png";
import emoteAnnoyed from "../../assets/tamagotchi/emotes/EMOTE_ANNOYED.png";
import emoteCalm from "../../assets/tamagotchi/emotes/EMOTE_CALM.png";
import emoteHappy from "../../assets/tamagotchi/emotes/EMOTE_HAPPY.png";
import emoteIdle from "../../assets/tamagotchi/emotes/EMOTE_IDLE.png";
import emoteMagical from "../../assets/tamagotchi/emotes/EMOTE_MAGICAL.png";
import emoteNeedy from "../../assets/tamagotchi/emotes/EMOTE_NEEDY.png";
import emoteProud from "../../assets/tamagotchi/emotes/EMOTE_PROUD.png";
import emoteSassy from "../../assets/tamagotchi/emotes/EMOTE_SASSY.png";
import emoteWorried from "../../assets/tamagotchi/emotes/EMOTE_WORRIED.png";
import tamagotchiTabImg from "../../assets/tamagotchi/tamagotchi_tab.png";
import { FALLBACK_BACKEND } from "../../constants/api";

const API_ORIGIN = FALLBACK_BACKEND;

console.log("API_ORIGIN =", API_ORIGIN);

const toAbsoluteUrl = (url) => {
  if (!url) return "";
  const u = String(url);

  if (u.startsWith("/")) return `${API_ORIGIN}${u}`;

  if (u.startsWith("http://localhost") || u.startsWith("https://localhost")) {
    try {
      const p = new URL(u);
      return `${API_ORIGIN}${p.pathname}${p.search}`;
    } catch {}
  }

  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${API_ORIGIN}/${u}`;
};

// ✅ plantId별로 저장 (전역 room_pixel_url 쓰면 "무조건 저 이미지" 현상 발생)
const pixelKey = (plantId) => (plantId ? `room_pixel_url:plant_${plantId}` : "room_pixel_url");
const roomKey = (plantId) => (plantId ? `room_image_url:plant_${plantId}` : "room_image_url");

// ✅ (중요) legacy 전역 키들 (이거 남아있으면 계속 섞임)
const LEGACY_KEYS = ["room_pixel_url", "room_image_url", "room_roomSig"];

const readStorage = (k) => sessionStorage.getItem(k) || localStorage.getItem(k) || "";
const writeStorage = (k, v) => {
  try {
    sessionStorage.setItem(k, v);
    localStorage.setItem(k, v);
  } catch {}
};
const removeStorage = (k) => {
  try {
    sessionStorage.removeItem(k);
    localStorage.removeItem(k);
  } catch {}
};

// ✅ 추가: legacy 전역 room_pixel_url 값이 있으면 "현재 plantId 전용 키"로 1회 마이그레이션
const readPixelForPlant = (plantId) => {
  if (!plantId) return "";

  const perPlant = readStorage(pixelKey(plantId));
  if (perPlant) return perPlant;

  // legacy 전역값이 남아있으면 현재 plant로 옮기고 전역은 제거
  const legacy = readStorage("room_pixel_url");
  if (legacy) {
    writeStorage(pixelKey(plantId), legacy);
    removeStorage("room_pixel_url");
    return legacy;
  }

  return "";
};

const PlantBoard = () => {
  const pixelRequestedRef = useRef(new Set());
  const pixelBuildingRef = useRef(false);
  const tamaReqInFlight = useRef(false);
  const location = useLocation();
  const prevRoomSigRef = useRef(null);

  const [activeView, setActiveView] = useState(
    () => localStorage.getItem("plantboard_active_view") || "timelog"
  );

  const [selectedPlant, setSelectedPlant] = useState(() => {
    try {
      const raw = localStorage.getItem("plantboard_selected_plant");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [diaryKey, setDiaryKey] = useState(0);

  useEffect(() => {
    if (activeView !== "tamagotchi") {
      tamaReqInFlight.current = false;
    }
  }, [activeView]);

  const [decorateItem, setDecorateItem] = useState(null);
  const [decoratedResult, setDecoratedResult] = useState(null);
  const [charPos, setCharPos] = useState({ x: 60, y: 70 });
  const [charJump, setCharJump] = useState(false);
  const [tamaState, setTamaState] = useState(null);

  // ✅ 현재 선택된 plantId에 대응되는 픽셀 URL만 state로 들고있기
  const [roomPixelUrlSS, setRoomPixelUrlSS] = useState("");

  const handleSelectPlant = useCallback((plant) => {
    setSelectedPlant((prev) => {
      if (!plant) return null;

      // 같은 식물 재선택이면 prev에 있던 pixelUrl 유지
      if (prev && String(prev.id) === String(plant.id)) {
        return {
          ...plant,
          roomImagePixelUrl: plant.roomImagePixelUrl || prev.roomImagePixelUrl,
          roomImageUrl: plant.roomImageUrl || prev.roomImageUrl,
        };
      }

      // ✅ 다른 식물로 바뀔 때: "이전 식물 픽셀 URL"이 넘어오면 섞이니까
      // storage(plant별 키)에서 캐시를 읽어오고, 없으면 null로 시작
      const plantId = String(plant.id);
      const cachedPixel = readStorage(pixelKey(plantId)) || "";
      return {
        ...plant,
        roomImagePixelUrl: plant.roomImagePixelUrl || cachedPixel || null,
      };
    });
  }, []);

  useEffect(() => {
    // ✅ legacy 키 중에서 "room_pixel_url"은 마이그레이션에 쓰므로 여기서 지우지 말 것
    // (readPixelForPlant가 필요할 때 plant별 키로 옮기고 지움)
    removeStorage("room_image_url");
    removeStorage("room_roomSig");
  }, []);

  // ✅ (추가) 선택된 plant의 roomImagePixelUrl이 "다른 plant 캐시"면 무효화해서 재생성 유도
  useEffect(() => {
    if (!selectedPlant?.id) return;

    const plantId = String(selectedPlant.id);
    const cached = readPixelForPlant(plantId);

    if (!selectedPlant.roomImagePixelUrl) return;

    // cache가 있으면: cache로 강제 동기화 (섞임 제거)
    if (cached && selectedPlant.roomImagePixelUrl !== cached) {
      setSelectedPlant((prev) => {
        if (!prev || String(prev.id) !== plantId) return prev;
        if (prev.roomImagePixelUrl === cached) return prev;
        return { ...prev, roomImagePixelUrl: cached };
      });
      return;
    }

    // cache가 없으면: 과거/섞인 값일 가능성 → null로 만들어 재생성 유도
    if (!cached) {
      setSelectedPlant((prev) => {
        if (!prev || String(prev.id) !== plantId) return prev;
        if (prev.roomImagePixelUrl == null) return prev;
        return { ...prev, roomImagePixelUrl: null };
      });

      pixelRequestedRef.current.delete(plantId);
      pixelBuildingRef.current = false;
    }
  }, [selectedPlant?.id, selectedPlant?.roomImagePixelUrl]);

  // ✅ plant 바뀔 때마다 그 plant의 pixel cache 읽기
  useEffect(() => {
    const plantId = selectedPlant?.id ? String(selectedPlant.id) : "";
    if (!plantId) {
      setRoomPixelUrlSS("");
      return;
    }
    setRoomPixelUrlSS(readPixelForPlant(plantId));
  }, [selectedPlant?.id]);

  const roomImgSrc = useMemo(() => {
    if (!selectedPlant) return "";

    const raw =
      selectedPlant.roomImagePixelUrl ||
      roomPixelUrlSS ||
      selectedPlant.roomImageUrl ||
      "";

    if (!raw) return "";

    const abs = toAbsoluteUrl(raw);

    // 캐시 버스터 추가 (같은 URL 재사용 방지)
    const bust =
      selectedPlant.updated_at ||
      selectedPlant.roomImageUpdatedAt ||
      selectedPlant.roomImageKey ||
      Date.now();

    return abs.includes("?")
      ? `${abs}&v=${encodeURIComponent(bust)}`
      : `${abs}?v=${encodeURIComponent(bust)}`;
  }, [
    selectedPlant?.roomImagePixelUrl,
    selectedPlant?.roomImageUrl,
    selectedPlant?.updated_at,
    roomPixelUrlSS,
  ]);

  // DB plant에 roomImageUrl 비어있으면 (예전 플로우) per-plant storage room_image_url 주입
  useEffect(() => {
    if (!selectedPlant?.id) return;

    if (!selectedPlant.roomImageUrl) {
      const plantId = String(selectedPlant.id);
      const ssUrl = readStorage(roomKey(plantId));

      if (ssUrl) {
        setSelectedPlant((prev) => {
          if (!prev) return prev;
          if (prev.roomImageUrl) return prev;
          return { ...prev, roomImageUrl: ssUrl };
        });
      }
    }
  }, [selectedPlant?.id, selectedPlant?.roomImageUrl]);

  useEffect(() => {
    setDecorateItem(null);
    setDecoratedResult(null);
  }, [location]);

  useEffect(() => {
    localStorage.setItem("plantboard_active_view", activeView);
  }, [activeView]);

  useEffect(() => {
    if (selectedPlant) {
      localStorage.setItem("plantboard_selected_plant", JSON.stringify(selectedPlant));
    } else {
      localStorage.removeItem("plantboard_selected_plant");
    }
  }, [selectedPlant]);

  useEffect(() => {
    pixelRequestedRef.current = new Set();
    pixelBuildingRef.current = false;
  }, [selectedPlant?.id]);

  // ✅ 방 원본이 바뀌면(=시그니처 변경) 해당 plant의 픽셀 캐시만 무효화해서 재생성 가능
  useEffect(() => {
    if (!selectedPlant?.id) return;

    const plantId = String(selectedPlant.id);

    const baseRoom = selectedPlant.roomImageUrl ? toAbsoluteUrl(selectedPlant.roomImageUrl) : "";

    const bust =
      selectedPlant.updated_at ||
      selectedPlant.roomImageUpdatedAt ||
      selectedPlant.roomImageKey ||
      selectedPlant.roomImageFilename ||
      "";

    const sig = `${baseRoom}::${bust}`;

    if (prevRoomSigRef.current === null) {
      prevRoomSigRef.current = sig;
      return;
    }

    if (baseRoom && prevRoomSigRef.current && sig !== prevRoomSigRef.current) {
      pixelRequestedRef.current.delete(plantId);
      pixelBuildingRef.current = false;

      setSelectedPlant((prev) => {
        if (!prev || String(prev.id) !== plantId) return prev;
        if (!prev.roomImagePixelUrl) return prev;
        return { ...prev, roomImagePixelUrl: null };
      });

      removeStorage(pixelKey(plantId));
      setRoomPixelUrlSS("");
    }

    prevRoomSigRef.current = sig;
  }, [selectedPlant?.id, selectedPlant?.roomImageUrl, selectedPlant?.updated_at]);

  // ✅ action 포함해서 /api/tamagotchi/state 재호출하는 공통 함수 (Hook은 최상위!)
  const requestTamaState = useCallback(
    async (action = "CHECKIN") => {
      if (!selectedPlant?.id) return;

      if (tamaReqInFlight.current) return;
      tamaReqInFlight.current = true;

      try {
        const plantId = String(selectedPlant.id);
        const roomUrlRaw = selectedPlant.roomImageUrl || "";

        if (!roomUrlRaw) {
          setTamaState({
            text: "방 이미지가 없어…",
            emote: "WORRIED",
            animation: "idle",
            tags: ["missing_roomImageUrl"],
          });
          return;
        }

        const bust =
          selectedPlant.updated_at ||
          selectedPlant.roomImageUpdatedAt ||
          selectedPlant.roomImageKey ||
          selectedPlant.roomImageFilename ||
          "";

        const absRoom = toAbsoluteUrl(roomUrlRaw);
        const imageUrlForApi = bust ? `${absRoom}?v=${encodeURIComponent(bust)}` : absRoom;

        const res = await fetchWithSession("/api/tamagotchi/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plant_id: selectedPlant.id,
            image_url: imageUrlForApi,
            action,
          }),
        });

        const data = await res.json();

        // ✅ url 있으면 픽셀 이미지 캐시 갱신
        if (data?.ok && data?.url) {
          const absPixelRaw = data.url.startsWith("http") ? data.url : `${API_ORIGIN}${data.url}`;

          const bustForPixel =
            selectedPlant.updated_at ||
            selectedPlant.roomImageUpdatedAt ||
            selectedPlant.roomImageKey ||
            selectedPlant.roomImageFilename ||
            Date.now();

          const absPixel = absPixelRaw.includes("?")
            ? `${absPixelRaw}&v=${encodeURIComponent(bustForPixel)}`
            : `${absPixelRaw}?v=${encodeURIComponent(bustForPixel)}`;

          writeStorage(pixelKey(plantId), absPixel);
          setRoomPixelUrlSS(absPixel);

          setSelectedPlant((prev) => {
            if (!prev || String(prev.id) !== plantId) return prev;
            if (prev.roomImagePixelUrl === absPixel) return prev;
            return { ...prev, roomImagePixelUrl: absPixel };
          });
        }

        // ✅ 멘트는 chat을 우선 사용
        const chat = data?.chat || {};
        setTamaState({
          text: (chat.text && String(chat.text).trim()) || "…",
          emote: (chat.emote && String(chat.emote).toUpperCase()) || "IDLE",
          animation: (chat.animation && String(chat.animation).toLowerCase()) || "idle",
          tags: Array.isArray(chat.tags) ? chat.tags : [`ACTION:${action}`],
        });
      } catch (e) {
        setTamaState({
          text: "요청 중 오류가 났어…",
          emote: "WORRIED",
          animation: "idle",
          tags: ["tama_request_error"],
        });
      } finally {
        tamaReqInFlight.current = false;
      }
    },
    [
      selectedPlant?.id,
      selectedPlant?.roomImageUrl,
      selectedPlant?.updated_at,
      selectedPlant?.roomImageUpdatedAt,
      selectedPlant?.roomImageKey,
      selectedPlant?.roomImageFilename,
    ]
  );

  // 다른 컴포넌트에서 방 이미지 업데이트 이벤트를 쏘면(가능하면 CustomEvent로 plantId 포함 추천)
  useEffect(() => {
    const sync = (evt) => {
      const plantId = selectedPlant?.id ? String(selectedPlant.id) : "";
      if (!plantId) return;

      const detailPlantId = evt?.detail?.plantId ? String(evt.detail.plantId) : null;
      if (detailPlantId && detailPlantId !== plantId) return;

      setRoomPixelUrlSS(readPixelForPlant(plantId));
    };

    window.addEventListener("room-image-updated", sync);
    return () => window.removeEventListener("room-image-updated", sync);
  }, [selectedPlant?.id]);

  // (옵션) 사용 안 하면 지워도 됨. 현재 로직은 /api/tamagotchi/state만 사용중
  const ensurePixelRoomImage = async (plant) => {
    if (tamaReqInFlight.current) return plant;
    if (!plant || !plant.roomImageUrl || plant.roomImagePixelUrl) return plant;
    try {
      const res = await fetchWithSession("/api/plantboard/room_pixel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: plant.roomImageUrl, plantId: plant.id }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        return data.plant ? data.plant : { ...plant, roomImagePixelUrl: data.url };
      }
    } catch (e) {
      console.error("Failed to build pixel room image:", e);
    }
    return plant;
  };

  // ✅ 다마고치 탭 들어오면 CHECKIN 멘트 요청 (중복 useEffect 제거: 이것만 유지)
  useEffect(() => {
    if (activeView !== "tamagotchi") return;
    if (!selectedPlant?.id) return;

    // 화면에 즉시 뜨는 기본 멘트
    setTamaState({
      text: "안녕! 오늘 컨디션 체크해볼게 🌱",
      emote: "IDLE",
      animation: "idle",
      tags: ["CHECKIN"],
    });

    requestTamaState("CHECKIN");
  }, [activeView, selectedPlant?.id, requestTamaState]);

  useEffect(() => {
    if (activeView !== "tamagotchi" || !selectedPlant) return;

    const rand = (min, max) => Math.random() * (max - min) + min;
    let mounted = true;

    const move = () => {
      if (!mounted) return;
      setCharPos({ x: rand(10, 80), y: rand(45, 80) });
      setCharJump(true);
      window.setTimeout(() => {
        if (mounted) setCharJump(false);
      }, 450);
    };

    move();
    const timer = window.setInterval(move, 5200 + Math.random() * 1800);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [activeView, selectedPlant]);

  const getPlantIcon = (plant) => {
    if (!plant) return null;
    if (plant.characterImageUrl) return plant.characterImageUrl;
    const raw = plant.characterName || plant.character || plant.characterId || plant.character_key || "";
    const key = String(raw).toLowerCase();
    const map = {
      "튼튼이": iconTt,
      "별꽃이": iconStar,
      "쭉쭉이": iconLong,
      "복실이": iconFluffy,
      "꼬불이": iconVine,
      plant_icon_1: iconTt,
      icon1: iconTt,
      "1": iconTt,
      plant_icon_2: iconStar,
      icon2: iconStar,
      "2": iconStar,
      plant_icon_3: iconLong,
      icon3: iconLong,
      "3": iconLong,
      plant_icon_4: iconFluffy,
      icon4: iconFluffy,
      "4": iconFluffy,
      plant_icon_5: iconVine,
      icon5: iconVine,
      "5": iconVine,
    };
    return map[key] || null;
  };

  const getEmoteOverlay = (emote) => {
    const map = {
      HAPPY: emoteHappy,
      NEEDY: emoteNeedy,
      ANNOYED: emoteAnnoyed,
      WORRIED: emoteWorried,
      CALM: emoteCalm,
      PROUD: emoteProud,
      MAGICAL: emoteMagical,
      SASSY: emoteSassy,
      IDLE: emoteIdle,
    };
    return map[emote] || emoteIdle;
  };

  const bubbleStyle = useMemo(() => {
    if (!selectedPlant) return { left: "8%", top: "8%" };
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    const left = clamp(charPos.x - 10, 6, 78);
    const top = clamp(charPos.y - 22, 8, 75);
    return { left: `${left}%`, top: `${top}%` };
  }, [charPos, selectedPlant]);

  const viewTitle = useMemo(() => {
    if (activeView === "tamagotchi") return "다마고치";
    if (activeView === "diary") return "다이어리";
    return "타임로그";
  }, [activeView]);

  return (
    <div className="plantboard-container">
      <aside className="plantboard-sidebar">
        <div
          className={`sidebar-compact-tab ${activeView === "timelog" ? "active" : ""}`}
          onClick={() => {
            setActiveView("timelog");
            setDecorateItem(null);
          }}
        >
          타임로그
        </div>

        <div
          className={`sidebar-section sidebar-section--tamagotchi ${
            activeView === "tamagotchi" ? "active" : ""
          } ${!selectedPlant ? "is-disabled" : ""}`}
          onClick={() => {
            if (!selectedPlant) return;
            setActiveView("tamagotchi");
            setDecorateItem(null);
          }}
        >
          <div className="sidebar-label">다 마 고 치</div>
          <div className="sidebar-content tamagotchi-placeholder">
            {selectedPlant ? (
              <div className="placeholder-box">
                {selectedPlant.roomImagePixelUrl || selectedPlant.roomImageUrl ? (
                  <img src={roomImgSrc} alt={`${selectedPlant.name} room`} className="tamagotchi-room-img" />
                ) : null}
              </div>
            ) : (
              <div className="placeholder-box">
                <img src={tamagotchiTabImg} alt="tamagotchi tab placeholder" className="tamagotchi-room-img" />
                <p className="tamagotchi-placeholder-text">식물을 선택하세요</p>
              </div>
            )}
          </div>
        </div>

        <div
          className={`sidebar-section sidebar-section--diary ${activeView === "diary" ? "active" : ""}`}
          onClick={() => {
            if (activeView === "diary") setDiaryKey((prev) => prev + 1);
            setActiveView("diary");
            setDecorateItem(null);
          }}
        >
          <div className="sidebar-label">다 이 어 리</div>
          <div className="sidebar-content diary-preview">
            <DiaryMiniPreview />
          </div>
        </div>
      </aside>

      <main className="plantboard-main">
        {(activeView === "timelog" || activeView === "tamagotchi" || activeView === "diary") && (
          <div className="plantboard-view-header">
            <h2 className="plantboard-view-title">{viewTitle}</h2>
          </div>
        )}

        {activeView === "timelog" && (
          <TimeLogPage
            onEnterDecorate={(item) => {
              setDecorateItem(item);
              setActiveView("decorate");
              setDecoratedResult(null);
            }}
            decoratedData={decoratedResult}
            initialActivePlantId={selectedPlant?.id || ""}
            onSelectPlant={handleSelectPlant}
            showHeader={false}
            showControls={true}
            showTimeline={true}
            showActionBar={true}
          />
        )}

        {activeView === "tamagotchi" && (
          <TimeLogPage
            onEnterDecorate={(item) => {
              setDecorateItem(item);
              setActiveView("decorate");
              setDecoratedResult(null);
            }}
            decoratedData={decoratedResult}
            initialActivePlantId={selectedPlant?.id || ""}
            onSelectPlant={handleSelectPlant}
            showHeader={false}
            showControls={true}
            showTimeline={false}
            showActionBar={true}
            enableFiltering={false}
            mode="tamagotchi"
            filterTabs={[
              { key: "water", label: "물 주기" },
              { key: "fertilizer", label: "비료 주기" },
              { key: "move", label: "자리 이동" },
              { key: "mist", label: "분무" },
              { key: "clean", label: "청소" },
            ]}
            onTamaAction={(actionKey) => {
              const quick = {
                water: "물 줄게! 💧",
                fertilizer: "비료 먹고 쑥쑥! 🌿",
                move: "자리 옮겨볼까? 🏃",
                mist: "분무는 촉촉~ 💦",
                clean: "청소하면 상쾌해! 🧽",
              };

              setTamaState((prev) => ({
                ...(prev || {}),
                text: quick[actionKey] || "잠깐만!",
                emote: "HAPPY",
                animation: "bounce",
                tags: [`ACTION:${actionKey}`],
              }));

              requestTamaState(actionKey);
            }}
          >
            <div className="tamagotchi-view-placeholder">
              {selectedPlant ? (
                <>
                  <div className="tamagotchi-room">
                    {selectedPlant.roomImagePixelUrl || selectedPlant.roomImageUrl ? (
                      <img src={roomImgSrc} alt={`${selectedPlant.name} room`} className="tamagotchi-room-img" />
                    ) : null}

                    <div className="tamagotchi-bubble tamagotchi-bubble--room" style={bubbleStyle}>
                      {tamaState?.text || "반응 데이터를 기다리는 중이야."}
                    </div>

                    {getPlantIcon(selectedPlant) ? (
                      <div
                        className={`tamagotchi-character ${charJump ? "is-jump" : ""} anim-${
                          tamaState?.animation || "idle"
                        }`}
                        style={{ left: `${charPos.x}%`, top: `${charPos.y}%` }}
                      >
                        <img
                          src={getPlantIcon(selectedPlant)}
                          alt={`${selectedPlant.name} character`}
                          className="tamagotchi-character__base"
                        />
                        <img
                          src={getEmoteOverlay(tamaState?.emote || "IDLE")}
                          alt={`${selectedPlant.name} emote`}
                          className="tamagotchi-character__emote"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="tamagotchi-panel">
                    <div className="tamagotchi-meta">
                      <span className="tama-pill">emote: {tamaState?.emote || "IDLE"}</span>
                      <span className="tama-pill">animation: {tamaState?.animation || "idle"}</span>
                    </div>
                    <div className="tamagotchi-tags">
                      {(tamaState?.tags || ["bucket:IDLE"]).map((tag) => (
                        <span key={tag} className="tama-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p>식물을 먼저 선택해 주세요.</p>
              )}
            </div>
          </TimeLogPage>
        )}

        {activeView === "diary" && <DiaryMainPage key={diaryKey} />}

        {activeView === "decorate" && (
          <DecorateContainer
            item={decorateItem}
            onCancel={() => {
              setActiveView("timelog");
              setDecorateItem(null);
            }}
            onSave={(decoratedData) => {
              setDecoratedResult({
                ...decoratedData,
                plantId: decorateItem?.plantId,
                plantName: decorateItem?.plantName,
              });
              setActiveView("timelog");
              setDecorateItem(null);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default PlantBoard;
