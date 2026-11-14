# 지옥 부족 스톤 헬퍼

스톤에이지 환각·성장·강화 계산기와 도감 (React + Vite, Vercel 서버 함수).

## 그냥 열어 보기
`바로실행/index.html` 을 더블클릭하면 브라우저에서 열립니다. (이 방식에서는 도감 추가하기·승인 관리가 동작하지 않습니다.)

## Vercel에 올리기 (도감 추가하기 쓰려면 필요)
1. 이 폴더를 GitHub 저장소에 올립니다. (`바로실행` 폴더는 빼도 됩니다)
2. vercel.com 에서 New Project → 그 저장소 선택 → Deploy.
3. 프로젝트의 **Storage** 탭 → **Create** → **Blob** → 이 프로젝트에 연결.
   (`BLOB_READ_WRITE_TOKEN` 환경변수가 자동으로 들어갑니다.)
4. **Settings → Environment Variables** 에 추가:
   - `ADMIN_PASSWORD` : 승인 관리 비밀번호 (길게)
   - `SESSION_SECRET` : 아무 긴 글자 (선택)
5. **Deployments** 에서 Redeploy.

사이트 맨 아래 `도감 추가하기`(또는 펫·아이템 도감의 ➕ 추가하기)로 제출 →
`관리자`(#review)에서 비밀번호로 로그인해 승인하면 1~10분 안에 모두에게 보입니다.

## 내 컴퓨터에서 개발
    npm install
    npm run dev          # 화면만 (서버 함수 없이)
    npx vercel dev       # 서버 함수까지 같이 (Vercel 로그인 필요)
    npm run build        # dist/
    npm run build:single # dist-single/ (파일 하나 + 그림 폴더)

## 폴더
- `src/pages` 화면, `src/lib` 계산, `src/data` 기본 데이터(json)
- `public/pets` `public/items` `public/chars` `public/maps` 그림
- `api/` 제출·로그인·승인 서버 함수 (Vercel Blob에 저장)
