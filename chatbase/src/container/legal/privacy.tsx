import LegalLayout from "@/container/legal/layout";
import { PrivacyContent, LEGAL_META } from "@/container/legal/content";

/**
 * /privacy 페이지. 본문은 랜딩 모달과 **같은 컴포넌트**를 쓴다.
 * 본문을 고칠 일이 있으면 `container/legal/content.tsx`에서 고친다.
 */
const Privacy = () => (
  <LegalLayout
    title={LEGAL_META.privacy.title}
    effectiveDate={LEGAL_META.privacy.effectiveDate}
  >
    <PrivacyContent />
  </LegalLayout>
);

export default Privacy;
