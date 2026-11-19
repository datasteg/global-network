import type { Lang } from '../types';

const S = {
  en: {
    kicker: 'Shocks',
    title: 'How shocks travel through trade and funding',
    lede: 'Replays of supply shocks along the trade links, two first-round scenarios and the dollar channel. Everything here is observed data or simple arithmetic on it, never a model. The episode catalogue and the trade events live on the two parents and are linked below.',
    tabs: { hub: 'All', replay: 'Shock replay', scenarios: 'Scenarios', dollar: 'Dollar channel' },
    sections: {
      replay: { title: 'Shock replay', text: 'A supply shock played month by month: the origin’s exports, its direct buyers, then their exports to third markets, with each economy recoloured by its funding [[f|flow score]] as the quarters pass.' },
      episodes: { title: 'Crisis episodes and trade events', text: 'The nine named [[episode|episodes]] of external funding stress are money-flow’s validation set and are catalogued on its method page; the trade events, with their timelines and sources, are trade-flow’s. Every yellow band on this site is one of them.', money: 'Episodes on money-flow', trade: 'Events on trade-flow' },
      scenarios: { title: 'Scenarios', text: '[[first_round|First-round]] arithmetic: a past funding withdrawal on today’s stock (S1), and the dollar scenario (S3) once relation E2 is accepted. A supplier dropping out is trade-flow’s case tool, a lender pulling back money-flow’s bank panel.' },
      dollar: { title: 'Dollar channel', text: 'When the dollar rises, do exports fall? Each economy’s 12-month export growth two quarters later against the [[dollar_index|broad dollar index]]’s change on a year earlier, pooled by reliance on FX credit.' },
    },
    open: 'Open',
  },
  ko: {
    kicker: '충격',
    title: '교역과 자금 경로로 번지는 충격',
    lede: '교역 연결을 따라 번지는 공급 충격의 재생, 1차 시나리오 둘, 달러 경로를 모았습니다. 모두 관측 자료이거나 그 자료에 단순 산술을 적용한 결과이며, 모형은 쓰지 않습니다. 위기 사례 목록과 교역 사건은 두 원천 사이트에 있으며 아래에 링크했습니다.',
    tabs: { hub: '전체', replay: '충격 재생', scenarios: '시나리오', dollar: '달러 경로' },
    sections: {
      replay: { title: '충격 재생', text: '공급 충격을 달마다 재생합니다. 충격은 진원지의 수출, 그 직접 수입국, 다시 그 수입국의 제3국 수출 순서로 번집니다. 분기가 지날 때마다 경제마다 [[f|자금흐름 점수]]에 해당하는 색을 입힙니다.' },
      episodes: { title: '위기 사례와 교역 사건', text: '이름 붙은 대외 자금 경색 [[episode|아홉 사례]]는 money-flow의 검증 집합이며, 그 목록은 money-flow 방법론 페이지에 있습니다. 교역 사건은 연표와 출처까지 trade-flow에 있습니다. 이 사이트의 노란 띠는 모두 이 가운데 하나입니다.', money: 'money-flow의 위기 사례', trade: 'trade-flow의 교역 사건' },
      scenarios: { title: '시나리오', text: '[[first_round|1차 산술]]만 씁니다. 과거의 자금 유출을 오늘 잔액에 대입하는 S1과, 관계 E2가 받아들여지면 여는 달러 시나리오 S3입니다. 공급국이 이탈하는 경우는 trade-flow의 사례 도구에서 다룹니다. 대출국이 대출을 줄이는 경우는 money-flow의 은행 패널에서 다룹니다.' },
      dollar: { title: '달러 경로', text: '달러가 오르면 수출이 줄어드나요? 경제마다 두 분기 뒤의 12개월 수출 증가율을 [[dollar_index|광의 달러 지수]]의 전년동기대비 변화와 비교하고, 외화 신용 의존도별로 묶었습니다.' },
    },
    open: '열기',
  },
};
export type ShocksStrings = typeof S.en;
export const shocks = (lang: Lang): ShocksStrings => (lang === 'ko' ? (S.ko as unknown as ShocksStrings) : S.en);
