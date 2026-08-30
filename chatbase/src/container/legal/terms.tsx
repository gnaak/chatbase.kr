import { Link } from "react-router-dom";

import LegalLayout, { Section, SubList } from "@/container/legal/layout";

const Terms = () => (
  <LegalLayout title="이용약관" effectiveDate="2026-05-03">
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

    <Section number="07" title="서비스 요금 및 결제">
      <SubList
        items={[
          "회사는 무료 플랜과 유료 플랜을 함께 제공하며, 플랜별 요금과 제공 범위는 서비스 내 요금 안내 페이지에 게시합니다.",
          "유료 플랜 요금에는 부가가치세가 별도로 부과되며, 정기결제는 회원이 해지하지 않는 한 결제 주기 단위로 자동 갱신됩니다.",
          "회원은 대시보드에서 언제든 해지할 수 있으며, 해지 시 이미 결제된 주기의 종료일까지 서비스를 이용할 수 있습니다.",
          "요금 또는 제공 범위가 변경되는 경우 시행일 30일 전까지 서비스 내 공지 또는 이메일로 안내합니다.",
          "회원이 LLM 제공자(OpenAI / Anthropic / Google)에 직접 지불하는 API 사용료는 서비스 이용료에 포함되지 않습니다.",
          "환불은 관련 법령 및 회사가 게시한 환불 정책에 따릅니다.",
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
        <Link to="/support" className="text-text-main hover:underline">
          1:1 문의
        </Link>
        {" "}또는{" "}
        <a
          href="mailto:hello@chatbase.kr"
          className="text-text-main hover:underline"
        >
          hello@chatbase.kr
        </a>
        로 보내주세요.
      </p>
    </Section>
  </LegalLayout>
);

export default Terms;
