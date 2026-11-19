// Sources page strings (EN, KO 해라체). Since 2 Nov 2026 the page shows the two parents' versions and surfaces, the files
// this site reads from each, and one compact dataset table whose citations point at the parents' method pages; the
// datasets themselves are described there, not here again.
import type { Lang } from '../types';

const S = {
  en: {
    kicker: 'Sources',
    title: 'Where every number comes from: two surfaces, nothing collected here',
    lede: 'global-network reads two export surfaces and nothing else (rule G18): money-flow’s release store and trade-flow’s data folder, each with a version this build pins. The parents describe their datasets, terms and checks on their own method pages; this page says which files were read and under which versions.',
    parents: 'The two parents at this build',
    money: {
      name: 'money-flow', release: 'Release', method: 'Method', surface: 'Surface version', built: 'Surface written',
      files: 'Files the surface offers', reads: 'What this site reads from it',
      readsList: ['world/global: the Signal Board (V, F, A2, net IIP, the quarterly trail), the pulse tiles and the withdrawal top', 'econ/<ISO3>: gross external assets and liabilities (IMF IIP) for the Financial scale view', 'earn/global: the World Bank WDI annual series and the IMF quarterly BOP and QNEA series behind How economies earn', 'changes/global: the money-side threshold crossings, shown as published', 'episodes/global: the validation set (episodes, global windows, out-of-scope spans, pre-window, threshold)', 'checks: check V23 (WDI against quarterly GDP), shown on this page', 'tables links.parquet and signals.parquet of the same release: BIS LBS, IMF PIP and DIP pairs, the dollar index and swap lines'],
      links: { method: 'money-flow method', sources: 'money-flow sources', world: 'the World page' },
    },
    trade: {
      name: 'trade-flow', built: 'Built', shown: 'Shown month', surface: 'Surface version', complete: 'Last complete year',
      files: 'Files the surface offers', reads: 'What this site reads from it',
      readsList: ['meta.json: the node list (names, regions, coordinates), shown and complete periods, the window rules', 'nodes/W/TOTAL and series/W|M/TOTAL: each economy’s 12-month exports, imports and completeness; the world series', 'snap/W/<slug>/<year>.w12|w3: the 12- and 3-month snapshots behind partners, pairs and the shock replays', 'chains/*, econ/<chain>/<year>: chain stages, chokepoints and each economy’s position in them', 'products.json: exports and imports by HS chapter over each economy’s 12-month window', 'changes.json: the trade-side threshold crossings, shown as published', 'events/index.json and config/events.yaml: the trade events, with the replay flag trade-flow sets from this site’s surface'],
      links: { method: 'trade-flow method', events: 'the events page' },
    },
    g18: 'Rule G18: global-network collects nothing; every series arrives through money-flow’s release or trade-flow’s data folder, and the footer names both versions. The build reads each surface.json first and stops on a major version it was not written for.',
    datasets: 'Datasets on this site, cited at their publisher',
    datasetsLede: 'Each dataset with its publisher page and licence class, and the parent whose method page describes how it is read, checked and shown. Nothing licensed passes through from either parent (no commercial data in any form, since 1 Nov 2026).',
    dsCols: { dataset: 'Dataset', publisher: 'Publisher', licence: 'Licence', via: 'Described on', read: 'Read' },
    cite: 'How to cite a page',
    citeLede: 'Cite the site, the page and the build date. The build date is the day this site joined the two surfaces; the money-flow release and trade-flow build it read are in the footer of every page and above.',
    citeForm: 'datasteg global-network, “<page title>”, built <build date>, <page URL>.',
    citeExample: (built: string, url: string) => `datasteg global-network, “About”, built ${built}, ${url}.`,
    citeUpstream: 'For the underlying figures cite the publisher and, where a number was derived, the parent: money-flow release and method version for funding, trade-flow build for trade.',
    source: 'money-flow surface.json and release manifest; trade-flow surface.json and meta.json; this site’s scripts/build.py (docs/SURFACES.md).',
  },
  ko: {
    kicker: '출처',
    title: '모든 수치의 출처(표면 둘, 직접 수집 자료 없음)',
    lede: 'global-network는 내보내기 표면 둘만 읽습니다(규칙 G18). money-flow의 릴리스 저장소와 trade-flow의 데이터 폴더이며, 각각 이 빌드가 고정한 버전이 있습니다. 데이터셋과 약관, 검사는 두 사이트가 제 방법론 페이지에 적습니다. 이 페이지는 어느 파일을 어느 버전으로 읽었는지 적습니다.',
    parents: '이번 빌드의 두 원천 사이트',
    money: {
      name: 'money-flow', release: '릴리스', method: '방법론', surface: '표면 버전', built: '표면 작성',
      files: '표면이 내는 파일', reads: '이 사이트가 읽는 것',
      readsList: ['world/global: 신호판(V, F, A2, 순대외금융자산, 분기 궤적), 맥박 타일, 유출 상위', 'econ/<ISO3>: 대외금융자산·부채 규모 화면의 대외금융자산과 대외금융부채(IMF IIP)', 'earn/global: “경제는 무엇으로 소득을 올리나” 화면의 세계은행 WDI 연간 계열과 IMF 분기 BOP·QNEA 계열', 'changes/global: 자금 쪽 기준치 통과, 낸 그대로', 'episodes/global: 검증 집합(사례, 세계 구간, 제외 구간, 사전 창, 기준치)', 'checks: 검사 V23(WDI와 분기 GDP 대조), 이 페이지에 싣습니다', '같은 릴리스의 테이블 links.parquet과 signals.parquet: BIS LBS, IMF PIP·DIP 쌍, 달러 지수와 연준 통화스왑'],
      links: { method: 'money-flow 방법론', sources: 'money-flow 출처', world: '세계 페이지' },
    },
    trade: {
      name: 'trade-flow', built: '빌드', shown: '표시 월', surface: '표면 버전', complete: '마지막 완결 연도',
      files: '표면이 내는 파일', reads: '이 사이트가 읽는 것',
      readsList: ['meta.json: 노드 목록(이름, 지역, 좌표), 표시·완결 시점, 창 규칙', 'nodes/W/TOTAL과 series/W|M/TOTAL: 각 경제의 12개월 수출·수입·신고율, 세계 계열', 'snap/W/<slug>/<year>.w12|w3: 교역 상대, 양자 관계, 충격 재생 뒤의 12개월·3개월 스냅샷', 'chains/*, econ/<chain>/<year>: 공급망 단계, 병목, 각 경제의 위치', 'products.json: 각 경제의 12개월 창 HS 품목별 수출입', 'changes.json: 교역 쪽 기준치 통과(공표 그대로)', 'events/index.json과 config/events.yaml: 교역 사건과, trade-flow가 이 사이트의 표면을 읽어 붙이는 재생 표시'],
      links: { method: 'trade-flow 방법론', events: '사건 페이지' },
    },
    g18: '규칙 G18. global-network는 아무것도 수집하지 않습니다. 모든 계열은 money-flow의 릴리스나 trade-flow의 데이터 폴더를 거쳐 오며, 하단에 두 버전을 적습니다. 빌드는 surface.json을 먼저 읽고, 모르는 주 버전이면 멈춥니다.',
    datasets: '이 사이트의 데이터셋, 발표기관 기준 인용',
    datasetsLede: '데이터셋마다 발표기관 페이지와 약관 등급을 담고, 수집·검사·표시 방법은 원천 사이트의 방법론 페이지에 적습니다. 라이선스 자료는 어느 쪽에서도 넘어오지 않습니다(2026년 11월 1일부터 상업 자료 전면 배제).',
    dsCols: { dataset: '데이터셋', publisher: '발표기관', licence: '약관', via: '설명 페이지', read: '수집' },
    cite: '페이지 인용 방법',
    citeLede: '사이트, 페이지, 빌드 날짜를 적습니다. 빌드 날짜는 이 사이트가 두 표면을 이은 날입니다. 읽은 money-flow 릴리스와 trade-flow 빌드는 모든 페이지 하단과 위에 있습니다.',
    citeForm: 'datasteg global-network, “<페이지 제목>”, <빌드 날짜> 빌드, <페이지 URL>',
    citeExample: (built: string, url: string) => `datasteg global-network, “소개”, ${built} 빌드, ${url}`,
    citeUpstream: '바탕 수치는 발표기관을 인용하고, 파생한 수치는 원천 사이트도 함께 적습니다. 자금은 money-flow 릴리스와 방법론 버전, 교역은 trade-flow 빌드입니다.',
    source: 'money-flow surface.json과 릴리스 목록, trade-flow surface.json과 meta.json, 이 사이트의 scripts/build.py(docs/SURFACES.md).',
  },
};
export type SourcesStrings = typeof S.en;
export const sources = (lang: Lang): SourcesStrings => (lang === 'ko' ? (S.ko as unknown as SourcesStrings) : S.en);
