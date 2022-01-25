// import { ReactComponent as Logo } from "../../assets/logo-rounded.svg";
import logo from "../../assets/logo-rounded.svg";

type LoadingOverlayProps = {
  message?: string;
};
const LoadingOverlay = ({ message }: LoadingOverlayProps) => {
  return (
    <div
      className="z-10 flex flex-col w-full h-full items-center justify-center absolute top-0 left-0"
      style={{ background: "rgba(255,255,255,0.75)" }}
    >
      <img
        src={logo}
        className="w-12 animate-bounce"
        alt="Bouncing Sourcify logo for loading content"
      />
      {message && <div className="mt-1">{message}</div>}
    </div>
  );
};

export default LoadingOverlay;
