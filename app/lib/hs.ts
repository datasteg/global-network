// Short names of the HS chapters (2-digit), English and Korean, for the product tables of the Overview panel and the
// country sheet. trade-flow's config/names.yaml holds the longer names; these fit a table cell. Chapters 77 (reserved),
// 98 and 99 (special use, not specified by kind) are never in the tables: build_products.py leaves them out, so they
// stay in "other".
import type { Lang } from './types';

const HS: Record<string, [string, string]> = {
  '01': ['Live animals', '산 동물'], '02': ['Meat', '육류'], '03': ['Fish & seafood', '수산물'],
  '04': ['Dairy, eggs & honey', '낙농품·알·꿀'], '05': ['Other animal products', '기타 동물성 제품'], '06': ['Plants & flowers', '식물·꽃'],
  '07': ['Vegetables', '채소'], '08': ['Fruit & nuts', '과일·견과'], '09': ['Coffee, tea & spices', '커피·차·향신료'],
  '10': ['Cereals', '곡물'], '11': ['Flour & malt', '제분·맥아'], '12': ['Oilseeds', '유지 종자'],
  '13': ['Gums & resins', '식물성 수지'], '14': ['Plaiting materials', '편조용 식물'], '15': ['Fats & oils', '동식물성 유지'],
  '16': ['Meat & fish preparations', '육류·어류 조제품'], '17': ['Sugar & confectionery', '설탕·당과'], '18': ['Cocoa & chocolate', '코코아·초콜릿'],
  '19': ['Cereal preparations', '곡물 조제품'], '20': ['Fruit & vegetable preparations', '채소·과일 조제품'], '21': ['Other food preparations', '기타 조제 식품'],
  '22': ['Beverages', '음료·주류'], '23': ['Animal feed', '사료'], '24': ['Tobacco', '담배'],
  '25': ['Salt, stone & cement', '소금·석재·시멘트'], '26': ['Ores', '광석'], '27': ['Mineral fuels & oil', '광물성 연료·석유'],
  '28': ['Inorganic chemicals', '무기화학품'], '29': ['Organic chemicals', '유기화학품'], '30': ['Pharmaceuticals', '의약품'],
  '31': ['Fertilisers', '비료'], '32': ['Dyes & paints', '염료·페인트'], '33': ['Cosmetics & perfumes', '화장품·향료'],
  '34': ['Soap & detergents', '비누·세제'], '35': ['Glues & enzymes', '접착제·효소'], '36': ['Explosives', '화약류'],
  '37': ['Photographic goods', '사진용 재료'], '38': ['Other chemicals', '기타 화학제품'], '39': ['Plastics', '플라스틱'],
  '40': ['Rubber', '고무'], '41': ['Hides & leather', '원피·가죽'], '42': ['Leather goods', '가죽제품'],
  '43': ['Furskins', '모피'], '44': ['Wood', '목재'], '45': ['Cork', '코르크'],
  '46': ['Basketware', '바구니 세공품'], '47': ['Pulp', '펄프'], '48': ['Paper', '종이'],
  '49': ['Printed matter', '인쇄물'], '50': ['Silk', '견'], '51': ['Wool', '양모'],
  '52': ['Cotton', '면'], '53': ['Other plant fibres', '기타 식물성 섬유'], '54': ['Man-made filaments', '인조 필라멘트'],
  '55': ['Man-made fibres', '인조 스테이플 섬유'], '56': ['Nonwovens & rope', '부직포·로프'], '57': ['Carpets', '양탄자'],
  '58': ['Special fabrics', '특수직물'], '59': ['Industrial textiles', '산업용 섬유'], '60': ['Knitted fabrics', '편물'],
  '61': ['Knitted clothing', '편직 의류'], '62': ['Woven clothing', '직물 의류'], '63': ['Other textiles', '기타 섬유제품'],
  '64': ['Footwear', '신발'], '65': ['Headgear', '모자'], '66': ['Umbrellas', '우산'],
  '67': ['Feathers & wigs', '깃털·가발'], '68': ['Stone articles', '석재 제품'], '69': ['Ceramics', '도자기'],
  '70': ['Glass', '유리'], '71': ['Gold, gems & jewellery', '금·귀금속·보석'], '72': ['Iron & steel', '철강'],
  '73': ['Steel articles', '철강 제품'], '74': ['Copper', '구리'], '75': ['Nickel', '니켈'],
  '76': ['Aluminium', '알루미늄'], '78': ['Lead', '납'], '79': ['Zinc', '아연'],
  '80': ['Tin', '주석'], '81': ['Other base metals', '기타 비금속'], '82': ['Tools', '공구'],
  '83': ['Metal articles', '금속 제품'], '84': ['Machinery & computers', '기계·컴퓨터'], '85': ['Electronics & electrical', '전기·전자기기'],
  '86': ['Railway equipment', '철도 차량'], '87': ['Vehicles & parts', '자동차·부품'], '88': ['Aircraft', '항공기'],
  '89': ['Ships', '선박'], '90': ['Optical & medical instruments', '광학·의료기기'], '91': ['Watches', '시계'],
  '92': ['Musical instruments', '악기'], '93': ['Arms', '무기'], '94': ['Furniture & lighting', '가구·조명'],
  '95': ['Toys & sports goods', '완구·운동용품'], '96': ['Other manufactures', '잡화'], '97': ['Art & antiques', '예술품·골동품'],
};

/** "30" → "Pharmaceuticals" / "의약품"; an unknown code falls back to "HS 30". */
export function hsName(ch: string, lang: Lang): string {
  const n = HS[ch];
  return n ? n[lang === 'ko' ? 1 : 0] : `HS ${ch}`;
}
