import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Button from "@/ui/button";
import ThemeToggle from "@/ui/themeToggle";
import { useAuth } from "@/hooks/common/useAuth";

const Nav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate("/");
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto h-14 px-6 md:px-8 flex items-center justify-between gap-6">
        <Link
          to="/"
          onClick={handleLogoClick}
          className="font-mono text-[14px] font-medium tracking-tight text-text-main"
        >
          chatbase.kr
        </Link>

        <nav className="hidden md:flex items-center gap-20 text-[13px] text-text-sub">
          <a href="#features" className="hover:text-text-main transition-colors">
            기능
          </a>
          <a href="#how" className="hover:text-text-main transition-colors">
            작동 방식
          </a>
          <a href="#pricing" className="hover:text-text-main transition-colors">
            가격
          </a>
          <a href="#faq" className="hover:text-text-main transition-colors">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/dashboard">
              <Button
                size="sm"
                pill
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                대시보드
              </Button>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-[13px] font-medium text-text-sub hover:text-text-main transition-colors px-2"
              >
                로그인
              </Link>
              <Link to="/signup">
                <Button size="sm" pill>
                  무료로 시작
                </Button>
              </Link>
            </>
          )}
          <div className="ml-1">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Nav;
