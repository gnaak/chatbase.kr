import { ReactNode } from "react";

export const Section = ({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) => (
  <section className="mt-10 first:mt-0">
    <h2 className="flex items-baseline gap-3 text-[16px] font-semibold tracking-tight text-text-main mb-3">
      <span className="font-mono text-[11px] text-text-sub">{number}</span>
      {title}
    </h2>
    <div className="text-[13px] text-text-main leading-[1.8] space-y-3">
      {children}
    </div>
  </section>
);

export const SubList = ({ items }: { items: ReactNode[] }) => (
  <ol className="list-decimal pl-5 space-y-1.5 text-text-sub">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ol>
);

/* ── 이용약관 ─────────────────────────────────── */

export const TermsContent = () => (
  <>
    <Section number="01" title="목적">
      <p>
        본 약관은 chatbase.kr(이하 "회사")이 제공하는 챗봇 임베드 SaaS(이하
        "서비스")의 이용 조건과 절차, 회원과 회사의 권리·의무 및 책임 사항을
        규정합니다.
      </p>
    </Section>

    <Section number="02" title="정의">
      <SubList
        items={[
          "회원: 본 약관에 동의하고 회사가 제공하는 서비스를 이용하는 자",
          "챗봇: 회원이 작성한 시스템 프롬프트와 학습 데이터를 기반으로 응답하는 AI 어시스턴트",
          "BYOK(Bring Your Own Key): 회원이 외부 LLM 제공자(OpenAI / Anthropic / Google)에서 발급받은 API 키를 직접 등록·사용하는 방식",
          "임베드 위젯: 회원이 자기 사이트에 코드 한 줄로 추가하여 표시되는 채팅 UI",
        ]}
      />
    </Section>

    <Section number="03" title="약관의 효력 및 변경">
      <p>
        본 약관은 회원이 회원가입 시 동의함으로써 효력이 발생합니다. 회사는 관련
        법령을 위반하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 시행일
        7일 전부터 서비스 내 공지 또는 이메일로 안내합니다.
      </p>
    </Section>

    <Section number="04" title="회원 가입 및 계정">
      <SubList
        items={[
          "회원가입은 이메일·비밀번호 또는 Google·Kakao OAuth로 진행됩니다.",
          "회원은 본인 계정 정보의 비밀유지 책임을 지며, 제3자에게 양도·대여할 수 없습니다.",
          "회사는 부정한 방법으로 가입하거나 타인의 정보를 도용한 경우 가입을 거부하거나 사후 탈퇴 처리할 수 있습니다.",
        ]}
      />
    </Section>

    <Section number="05" title="서비스 이용">
      <p>
        회원은 본 서비스를 통해 챗봇을 생성·관리하고, 자기 사이트에 임베드할 수
        있습니다. 회사는 안정적인 서비스 제공을 위해 노력하나, 점검·장애·외부
        LLM 제공자 사정 등으로 일시 중단될 수 있습니다.
      </p>
    </Section>

    <Section number="06" title="BYOK 및 외부 LLM 이용">
      <SubList
        items={[
          "회원은 본 서비스를 이용하기 위해 OpenAI, Anthropic, Google 등 외부 LLM 제공자의 API 키를 직접 발급받아 회사 시스템에 등록해야 합니다.",
          "외부 LLM 제공자에 대한 사용량·과금·이용약관은 해당 제공자와 회원 간의 직접적인 계약 관계이며, 회사는 이에 대한 책임을 지지 않습니다.",
          "회사는 회원이 등록한 API 키를 암호화하여 저장하며, 회원의 챗봇이 응답을 생성할 때만 복호화하여 사용합니다.",
          "회원은 자신의 키로 발생하는 모든 호출과 비용에 대한 책임을 집니다.",
        ]}
      />
    </Section>

    <Section number="07" title="베타 서비스 안내">
      <SubList
        items={[
          "본 서비스는 현재 베타(BETA) 단계로 무료로 제공됩니다.",
          "베타 기간 중 일부 기능은 추가·변경·제거될 수 있습니다.",
          "정식 출시 시 유료 전환될 수 있으며, 사전에 충분한 기간을 두고 회원에게 안내합니다.",
          "베타 사용자에게는 정식 출시 시 별도의 할인 또는 혜택이 제공될 수 있습니다.",
        ]}
      />
    </Section>

    <Section number="08" title="회원의 의무">
      <SubList
        items={[
          "회원은 관련 법령, 본 약관, 회사가 공지하는 운영 정책을 준수해야 합니다.",
          "회원은 자신의 챗봇이 생성하는 응답으로 인해 발생하는 모든 책임을 부담합니다.",
          "회원은 타인의 권리를 침해하거나, 음란·폭력·차별·범죄 조장 등 위법한 콘텐츠를 챗봇 학습 데이터로 사용하거나 챗봇이 생성하도록 유도해서는 안 됩니다.",
          "회원은 외부 LLM 제공자의 이용약관을 준수해야 합니다.",
        ]}
      />
    </Section>

    <Section number="09" title="회사의 의무">
      <SubList
        items={[
          "회사는 본 약관 및 관련 법령이 금지하는 행위를 하지 않으며, 안정적·지속적인 서비스 제공을 위해 노력합니다.",
          "회사는 회원의 개인정보 및 등록 키를 안전하게 관리하기 위한 보안 시스템을 갖춥니다.",
          "회사는 서비스 이용과 관련된 회원의 의견·불만을 신속히 처리하기 위해 노력합니다.",
        ]}
      />
    </Section>

    <Section number="10" title="서비스 변경 및 중단">
      <p>
        회사는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경·중단할
        수 있으며, 중대한 변경의 경우 서비스 내 공지 또는 이메일로 사전 안내
        합니다.
      </p>
    </Section>

    <Section number="11" title="계약 해지 및 탈퇴">
      <p>
        회원은 언제든지 설정 페이지에서 계정을 삭제하여 탈퇴할 수 있습니다. 탈퇴
        시 회원의 모든 챗봇·대화 로그·등록된 API 키는 즉시 삭제되며 복구할 수
        없습니다.
      </p>
    </Section>

    <Section number="12" title="책임 제한">
      <SubList
        items={[
          "회사는 천재지변, 외부 LLM 제공자의 장애, 회원의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.",
          "회사는 챗봇이 생성한 응답의 정확성·적법성·적합성에 대해 보증하지 않으며, 그로 인해 발생하는 손해에 대한 책임을 지지 않습니다.",
          "회사의 책임은 관련 법령에서 허용하는 한도 내에서 제한됩니다.",
        ]}
      />
    </Section>

    <Section number="13" title="분쟁 해결 및 준거법">
      <p>
        본 약관과 관련된 분쟁은 대한민국 법령에 따라 해석·적용되며, 분쟁 발생 시
        회사 본점 소재지 관할 법원을 1심 관할로 합니다.
      </p>
    </Section>

    <Section number="14" title="문의">
      <p>
        본 약관과 서비스에 대한 문의는{" "}
        <a
          href="mailto:hello@chatbase.kr"
          className="text-text-main hover:underline"
        >
          hello@chatbase.kr
        </a>
        로 보내주세요.
      </p>
    </Section>
  </>
);

/* ── 개인정보처리방침 ─────────────────────────── */

export const PrivacyContent = () => (
  <>
    <Section number="01" title="개요">
      <p>
        chatbase.kr(이하 "회사")은 「개인정보 보호법」 등 관련 법령을 준수하고,
        이용자의 개인정보를 안전하게 보호하기 위해 본 개인정보처리방침을
        수립·공개합니다.
      </p>
    </Section>

    <Section number="02" title="수집하는 개인정보 항목 및 목적">
      <SubList
        items={[
          "회원가입 및 인증: 이메일, 이름(닉네임), 비밀번호(해시 저장), 또는 OAuth 제공자(Google / Kakao)에서 받은 프로필 이미지·이메일",
          "서비스 이용: 등록한 챗봇 정보(이름, 시스템 프롬프트, 학습 데이터, 모델 선택), 외부 LLM API 키(암호화 저장)",
          "대화 로그: 임베드 위젯에서 발생한 방문자 메시지·응답·세션 식별자",
          "서비스 운영·개선: 접속 로그, 쿠키, 기기 정보(IP, User-Agent)",
        ]}
      />
    </Section>

    <Section number="03" title="개인정보의 보유 및 이용 기간">
      <SubList
        items={[
          "회원 정보: 회원 탈퇴 시까지 보관하며, 탈퇴 시 즉시 파기합니다.",
          "대화 로그: 챗봇이 삭제되거나 회원이 탈퇴할 때까지 보관합니다.",
          "외부 LLM API 키: 회원이 직접 삭제하거나 탈퇴할 때까지 암호화하여 보관합니다.",
          "관련 법령에 따라 보존이 필요한 경우 해당 법령이 정한 기간 동안 보관합니다(예: 통신비밀보호법 3개월).",
        ]}
      />
    </Section>

    <Section number="04" title="개인정보의 제3자 제공">
      <p>
        회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만
        다음의 경우는 예외로 합니다.
      </p>
      <SubList
        items={[
          "이용자가 사전에 동의한 경우",
          "법령에 의해 제공이 요구되는 경우",
          "BYOK 모델 특성상, 챗봇 응답을 생성하기 위해 이용자가 등록한 외부 LLM 제공자(OpenAI, Anthropic, Google 등)에 메시지가 전달됩니다. 이는 이용자의 키와 계정으로 직접 호출되며, 각 제공자의 개인정보처리방침이 적용됩니다.",
        ]}
      />
    </Section>

    <Section number="05" title="개인정보 처리의 위탁">
      <p>회사는 안정적인 서비스 제공을 위해 다음과 같은 업무를 위탁합니다.</p>
      <SubList
        items={[
          "결제 처리: 토스페이먼츠 (정식 출시 시점부터 적용)",
          "인프라 호스팅: 클라우드 인프라 제공 업체 (예: AWS / Google Cloud / 자체 호스팅)",
        ]}
      />
    </Section>

    <Section number="06" title="이용자 및 법정대리인의 권리">
      <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
      <SubList
        items={[
          "개인정보 열람·정정·삭제 요청 (대시보드 설정 페이지 또는 이메일 문의)",
          "개인정보 처리 정지 요청",
          "동의 철회 및 회원 탈퇴 (계정 삭제)",
        ]}
      />
    </Section>

    <Section number="07" title="개인정보의 안전성 확보 조치">
      <SubList
        items={[
          "외부 LLM API 키: Fernet(AES-128 기반) 대칭키 암호화 후 데이터베이스에 저장하며, 평문은 어떤 시점에도 저장되지 않습니다.",
          "비밀번호: argon2 해시 알고리즘으로 단방향 암호화하여 저장합니다.",
          "전송 구간: HTTPS(TLS)로 암호화합니다.",
          "접근 통제: 운영자 접근 권한을 최소화하고 로그를 기록합니다.",
          "정기 점검: 보안 취약점을 정기적으로 점검하고 패치합니다.",
        ]}
      />
    </Section>

    <Section number="08" title="쿠키 및 자동 수집 도구">
      <p>
        회사는 로그인 세션 유지를 위해 쿠키(JWT 토큰)를 사용합니다. 임베드
        위젯은 방문자 식별을 위해 localStorage에 임의의 visitor_id를
        저장합니다. 이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이
        경우 일부 기능 이용이 제한될 수 있습니다.
      </p>
    </Section>

    <Section number="09" title="개인정보 보호책임자">
      <p>
        개인정보 처리에 관한 문의·민원은 아래 연락처로 접수해주세요.
      </p>
      <SubList
        items={[
          "개인정보 보호책임자: chatbase.kr 운영자",
          <>
            이메일:{" "}
            <a
              href="mailto:hello@chatbase.kr"
              className="text-text-main hover:underline"
            >
              hello@chatbase.kr
            </a>
          </>,
        ]}
      />
    </Section>

    <Section number="10" title="고지 의무">
      <p>
        본 방침의 내용 추가·삭제 및 수정이 있을 시 시행 7일 전부터 서비스 내
        공지 또는 이메일을 통해 고지합니다.
      </p>
    </Section>
  </>
);

export const LEGAL_META = {
  terms: { title: "이용약관", effectiveDate: "2026-05-03" },
  privacy: { title: "개인정보처리방침", effectiveDate: "2026-05-03" },
};
