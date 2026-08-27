import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Topbar from "@/component/dashboard/layout/topbar";
import Card from "@/component/dashboard/ui/card";
import Button from "@/component/dashboard/ui/button";
import { usePost } from "@/hooks/common/useAPI";
import type {
  BillingMethod,
  RegisterMethodRequest,
  SubscribeRequest,
  Subscription,
} from "@/types/payment";

type Phase = "registering" | "charging" | "registered" | "paid" | "error";

/**
 * 토스 카드 등록창이 성공 시 리다이렉트해 오는 화면.
 * 쿼리로 `authKey`, `customerKey`가 붙어온다.
 *
 * 여기서 서버에 등록을 요청해야 billingKey가 발급된다 — 이 호출을 건너뛰면
 * 카드는 인증만 되고 우리 쪽에는 아무것도 남지 않는다.
 *
 * `plan` 쿼리가 함께 오면 "플랜 시작" 흐름에서 온 것이므로 등록에 이어 결제까지 진행한다.
 * 결제수단 화면에서 카드만 추가한 경우에는 `plan`이 없어 등록에서 끝난다.
 */
const BillingSuccess = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const authKey = params.get("authKey");
  const customerKey = params.get("customerKey");
  const plan = params.get("plan");

  const [phase, setPhase] = useState<Phase>("registering");
  const [error, setError] = useState<string | null>(null);
  // StrictMode의 이중 실행으로 카드가 두 번 등록/결제되는 것을 막는다.
  const requested = useRef(false);

  const registerMutation = usePost<RegisterMethodRequest, BillingMethod>(
    "api/payment/methods",
  );
  const subscribeMutation = usePost<
    SubscribeRequest,
    { subscription: Subscription; plan: string }
  >("api/payment/subscribe");

  const { mutateAsync: register } = registerMutation;
  const { mutateAsync: subscribe } = subscribeMutation;

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    if (!authKey || !customerKey) {
      setPhase("error");
      setError("카드 등록 정보가 올바르지 않습니다. 다시 시도해 주세요.");
      return;
    }

    const run = async () => {
      let method: BillingMethod;
      try {
        method = await register({ authKey, customerKey });
        queryClient.invalidateQueries({ queryKey: ["billing-methods"] });
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
      } catch (err) {
        setPhase("error");
        setError(
          (err as { message?: string })?.message ||
            "결제수단 등록에 실패했습니다.",
        );
        return;
      }

      if (!plan) {
        setPhase("registered");
        return;
      }

      // 등록은 이미 끝났다. 결제만 실패해도 결제수단은 남는다.
      setPhase("charging");
      try {
        await subscribe({ plan, method_id: method.id });
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
        queryClient.invalidateQueries({ queryKey: ["payments"] });
        queryClient.invalidateQueries({ queryKey: ["usage"] });
        setPhase("paid");
      } catch (err) {
        setPhase("error");
        setError(
          (err as { message?: string })?.message ||
            "결제수단은 등록됐지만 결제에 실패했습니다.",
        );
      }
    };

    void run();
  }, [authKey, customerKey, plan, register, subscribe, queryClient]);

  const pending = phase === "registering" || phase === "charging";

  return (
    <>
      <Topbar title="결제" backTo="/dashboard/billing" />

      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        <Card variant="elevated" className="max-w-md mx-auto p-8">
          <div className="flex flex-col items-center text-center gap-3">
            {phase === "error" ? (
              <>
                <div className="w-11 h-11 rounded-full bg-bg-sub flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-point-red" />
                </div>
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">
                  처리하지 못했습니다
                </h2>
                <p className="text-[13px] text-text-sub leading-relaxed break-keep">
                  {error}
                </p>
              </>
            ) : pending ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-text-sub" />
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">
                  {phase === "registering"
                    ? "결제수단을 등록하고 있습니다"
                    : "결제를 진행하고 있습니다"}
                </h2>
                <p className="text-[13px] text-text-sub leading-relaxed">
                  창을 닫지 말고 잠시만 기다려 주세요.
                </p>
              </>
            ) : (
              <>
                <div className="w-11 h-11 rounded-full bg-success-bg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <h2 className="text-[15px] font-semibold tracking-tight text-text-main">
                  {phase === "paid"
                    ? "결제가 완료되었습니다"
                    : "결제수단이 등록되었습니다"}
                </h2>
                <p className="text-[13px] text-text-sub leading-relaxed break-keep">
                  {phase === "paid"
                    ? "플랜이 바로 적용됩니다. 다음 결제일은 결제 화면에서 확인하실 수 있습니다."
                    : "이제 이 수단으로 플랜을 시작하거나, 기본 결제수단으로 지정할 수 있습니다."}
                </p>
              </>
            )}

            {!pending && (
              <Button
                size="sm"
                pill
                variant="primary"
                className="mt-2"
                onClick={() => navigate("/dashboard/billing", { replace: true })}
              >
                결제 화면으로
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  );
};

export default BillingSuccess;
