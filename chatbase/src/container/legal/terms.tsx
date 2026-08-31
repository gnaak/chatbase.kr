import LegalLayout from "@/container/legal/layout";
import { TermsContent, LEGAL_META } from "@/container/legal/content";

/**
 * /terms 페이지. 본문은 랜딩 모달과 **같은 컴포넌트**를 쓴다.
 * 예전에는 여기에 전문이 복붙돼 있어서 모달과 갈라질 수 있었다 —
 * 본문을 고칠 일이 있으면 `container/legal/content.tsx`에서 고친다.
 */
const Terms = () => (
  <LegalLayout
    title={LEGAL_META.terms.title}
    effectiveDate={LEGAL_META.terms.effectiveDate}
  >
    <TermsContent />
  </LegalLayout>
);

export default Terms;
