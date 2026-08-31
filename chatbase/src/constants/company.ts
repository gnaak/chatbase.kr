/**
 * 사업자 정보 — 단일 출처.
 *
 * 전자상거래법 제10조가 **사이버몰 초기 화면**에 상호·대표자·주소·전화·이메일·
 * 사업자등록번호·통신판매업 신고번호를 표시하도록 요구한다. 그래서 랜딩 푸터가
 * 법정 표기 지점이고, 약관·개인정보처리방침은 같은 값을 다시 쓴다.
 *
 * 이메일이 지금 9곳에 흩어져 있는 전철을 밟지 않으려고 여기 모았다.
 * 주소나 전화번호가 바뀌면 이 파일만 고친다.
 *
 * ⚠️ 서비스명(chatbase.kr)과 법정 상호(담쟁이)는 다르다. 법정 표기는 상호를 쓴다.
 */
export const COMPANY = {
  /** 사업자등록증상 상호. 브랜드명(chatbase.kr)과 다르다 */
  name: "담쟁이",
  ceo: "이근학",
  bizNumber: "392-03-04435",
  /** 통신판매업 신고번호 — 2026-08-31 정부24 접수(20260831-73546869), 처리 후 기입 */
  mailOrderNumber: "",
  /**
   * 사업장 주소 — 자택이다. **등록증에는 동·호수까지 있지만 여기는 도로명까지만 쓴다.**
   * 표시 의무는 지키되 세대는 특정되지 않게 하려는 것. 1인 사업자가 흔히 쓰는 절충이다.
   * 나중에 비상주 사무실로 옮기면 홈택스 정정신고 + 통신판매업 변경신고 후 이 값만 바꾼다.
   */
  address: "서울특별시 강남구 삼성로 151",
  tel: "010-2744-7735",
  /**
   * 전화 응대 시간. 같이 표기하면 부재중이어도 자연스럽고, 실제 인바운드는
   * 대부분 이메일·1:1 문의로 온다. 빈 문자열이면 시간 표기 없이 번호만 나온다.
   */
  telHours: "평일 10:00–18:00",
  email: "hello@chatbase.kr",
  /** 개인정보보호법상 보호책임자는 성명을 표시해야 한다 */
  privacyOfficer: "이근학",
} as const;

/**
 * 푸터 사업자정보 노출 스위치.
 *
 * **통신판매업 신고가 수리되기 전까지는 끈다.** 신고번호 없이 상호·주소·전화만
 * 먼저 내보이고 싶지 않다는 판단이다. 아직 라이브 결제 키가 없어 통신판매를
 * 개시하지 않은 상태라 전자상거래법 제10조 표시 의무도 아직 걸리지 않는다.
 *
 * 신고번호가 나오면 `mailOrderNumber`를 채우면서 **이 값도 같이 true로 바꾼다.**
 * 결제를 받기 시작하는데 이게 false로 남아 있으면 그때는 법 위반이다.
 */
export const SHOW_BUSINESS_INFO = false;

/**
 * 푸터에 나열할 사업자정보. **값이 빈 항목은 행 자체를 만들지 않는다** —
 * "전화 :" 뒤에 아무것도 없는 상태로 노출되는 것보다 항목이 없는 편이 낫다.
 */
export const BUSINESS_INFO_ROWS: ReadonlyArray<{
  label: string;
  value: string;
}> = [
  { label: "상호", value: COMPANY.name },
  { label: "대표자", value: COMPANY.ceo },
  { label: "사업자등록번호", value: COMPANY.bizNumber },
  { label: "통신판매업 신고번호", value: COMPANY.mailOrderNumber },
  { label: "주소", value: COMPANY.address },
  {
    label: "전화",
    value: COMPANY.tel
      ? `${COMPANY.tel}${COMPANY.telHours ? ` (${COMPANY.telHours})` : ""}`
      : "",
  },
  { label: "이메일", value: COMPANY.email },
].filter((row) => row.value.length > 0);

/**
 * 공정거래위원회 통신판매사업자 조회 링크.
 * 신고번호가 나오기 전에는 조회 결과가 비어 있으므로 그때까지 노출하지 않는다.
 */
export const FTC_LOOKUP_URL = COMPANY.mailOrderNumber
  ? `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${COMPANY.bizNumber.replace(/-/g, "")}`
  : null;
