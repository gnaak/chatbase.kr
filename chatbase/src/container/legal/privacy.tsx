import LegalLayout, { Section, SubList } from "@/container/legal/layout";

const Privacy = () => (
  <LegalLayout title="개인정보처리방침" effectiveDate="2026-05-03">
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
          "회원 정보: 회원 탈퇴 시까지. 탈퇴 시 즉시 파기.",
          "대화 로그: 챗봇이 삭제되거나 회원이 탈퇴할 때까지.",
          "외부 LLM API 키: 회원이 직접 삭제하거나 탈퇴할 때까지. 암호화하여 저장.",
          "관련 법령에 따라 보존이 필요한 경우 해당 법령이 정한 기간 동안 보관(예: 통신비밀보호법 3개월).",
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
          "결제 처리: 토스페이먼츠 (유료 플랜 이용 시)",
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
          "외부 LLM API 키: Fernet(AES-128 기반) 대칭키 암호화 후 데이터베이스에 저장. 평문은 어떤 시점에도 저장되지 않습니다.",
          "비밀번호: argon2 해시 알고리즘으로 단방향 저장.",
          "전송 구간: HTTPS(TLS) 암호화.",
          "접근 통제: 운영자 접근 권한 최소화 및 로그 기록.",
          "정기 점검: 보안 취약점 점검 및 패치.",
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
  </LegalLayout>
);

export default Privacy;
