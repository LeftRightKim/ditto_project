## Ditto_project
# 프로젝트 소개
Ditto는 사용자의 공간 이미지와 식물 데이터를 기반으로  
AI가 식물을 추천하고, 실제 공간 이미지 위에 식물을 배치 및 생성하며
픽셀 스타일 인터랙션과 캐릭터 시스템까지 제공하는  
AI 기반 식물 라이프스타일 플랫폼 프로젝트입니다.

# 프로젝트 목표

- 사용자 공간 기반 추천 시스템 구현
- AI 기반 이미지 처리 및 시각화
- 사용자 인터랙션 중심 UX 제공
- 이미지 상태 동기화 및 캐시 최적화
- API 기반 서비스 파이프라인 구축
- AI 서비스 흐름 설계 및 운영 경험 확보

# Service Pipeline

## 공간 분석 및 추천 Pipeline

사용자 이미지 업로드  
→ 서버 저장(S3)  
→ 공간 이미지 분석  
→ 사용자 환경 기반 추천 데이터 생성  
→ 추천 식물 계산  
→ 결과 데이터 반환  
→ Frontend 상태 반영

## 이미지 생성 Pipeline

Room Image Upload  
→ Storage 저장  
→ AI 분석 요청  
→ 식물 위치 계산  
→ 생성 이미지 생성  
→ roomImageUrl 저장  
→ Pixel Transformation 처리  
→ roomImagePixelUrl 생성  
→ Frontend 렌더링

## Pixel Transformation Pipeline

Original Room Image  
→ Pixel Transform 처리  
→ plantId 기반 캐싱  
→ 기존 이미지 비교(room signature)  
→ stale cache 검증  
→ cache bust 처리  
→ 최종 Pixel Image 반환

## Tamagotchi Interaction Pipeline

사용자 활동(TimeLog)  
→ 식물 상태 계산  
→ Emotion State 생성  
→ Character Animation 변경  
→ Bubble Message 처리  
→ Room Image Overlay 렌더링

# API 구조

## 주요 API

### 사용자 식물 데이터 조회
GET /api/plantboard/plants

- 사용자 식물 목록 조회
- 상태 데이터 반환
- room image 연동

### Pixel Room Image 생성
POST /api/plantboard/room_pixel

- Room Image 기반 Pixel Image 생성
- plantId 기반 캐싱 처리
- 이미지 재생성 로직 수행


### Tamagotchi 상태 처리
GET /api/tamagotchi/state

- 식물 상태 기반 Emotion 계산
- 캐릭터 상태 반환
- animation state 생성

---

### 이미지 업로드 API
POST /api/upload

- 사용자 이미지 업로드
- AWS S3 저장 처리
- URL 반환


# 주요 기능

## 1. AI 기반 식물 추천 시스템
- 사용자 공간 이미지 기반 추천
- 공간 분위기 기반 식물 추천
- 식물 조합 추천 기능
- 시각화 기반 추천 결과 제공

## 2. 이미지 생성 및 합성 시스템
- 사용자 Room Image 기반 식물 배치
- AI 기반 생성 이미지 처리
- 이미지 저장 및 상태 연동
- 생성 이미지 시각화 제공

## 3. Pixel Image 변환 시스템
- Room Image Pixel 변환
- Pixel Cache 분리 처리
- stale image 검증
- dynamic image regeneration 처리

## 4. Tamagotchi Interaction 시스템
- 감정 상태 기반 캐릭터 처리
- animation 및 overlay 구현
- bubble message 시스템
- room image 기반 위치 계산

## 5. 성장 기록(TimeLog) 시스템
- 물주기 / 비료 / 분무 기록
- timeline 기반 활동 관리
- 날짜별 grouping
- 활동 통계 처리



# 담당 역할

## 팀장 역할 수행
- 프로젝트 일정 조율
- 기능 단위 역할 분배
- 서비스 구조 및 기능 흐름 설계

## 개발 담당
- React 기반 Frontend 구현
- FastAPI 기반 API 연동
- 이미지 상태관리 및 비동기 처리 구현
- 캐시 충돌 및 상태 동기화 문제 해결
- AWS S3 기반 이미지 저장 및 관리 구현

# 기술적 문제 해결 경험

## 1. 이미지 캐시 충돌 문제 해결
문제:
- 이전 생성 이미지가 재사용되는 문제 발생
- 다른 식물 이미지가 혼합되는 현상 발생

해결:
- plantId 기반 캐시 분리
- room signature 비교 로직 구현
- cache bust 처리 적용

## 2. 비동기 상태 동기화 문제 해결
문제:
- React 상태 변경 시 이미지 상태 불일치 발생
- 중복 API 요청 및 렌더링 문제 발생

해결:
- useEffect dependency 구조 개선
- request in-flight 방지 로직 구현
- 상태 분리 및 memoization 적용

## 3. 이미지 재생성 무한 루프 문제 해결
문제:
- 특정 상태 변경 시 이미지 생성 API 반복 호출 발생

해결:
- 조건 기반 regeneration 로직 구현
- 이전 상태 비교 처리 적용


# 프로젝트를 통해 얻은 경험

- AI 기반 서비스 흐름 설계 경험
- API 중심 서비스 구조 설계 경험
- 이미지 처리 및 상태 동기화 경험
- 비동기 처리 및 캐시 최적화 경험
- 사용자 인터랙션 중심 UI 구현 경험
- 서비스 운영 환경 문제 해결 경험
- 팀 프로젝트 일정 및 기능 관리 경험
