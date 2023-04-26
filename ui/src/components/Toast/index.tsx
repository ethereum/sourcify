import { ReactElement } from "react";
import { HiX } from "react-icons/hi";

type ToastProps = {
  message: string | ReactElement;
  isShown: boolean;
  dismiss: () => void;
};

// Template from https://www.tailwind-elements.com/docs/standard/components/toast/
const Toast = ({ message, isShown, dismiss }: ToastProps) => {
  if (!isShown) return null;
  return (
    <div
      className="z-20 fixed top-0 left-0 right-0 mt-4 margin-auto bg-red-400 shadow-md mx-auto w-96 max-w-full text-sm pointer-events-auto bg-clip-padding rounded-lg block mb-3"
      id="static-example"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      data-mdb-autohide="false"
    >
      <div className="bg-red-400 flex justify-between items-center py-2 px-3 bg-clip-padding border-b border-red-300 rounded-t-lg">
        <h2 className="font-bold text-white text-lg ">Error</h2>
        <div className="flex items-center">
          <button
            type="button"
            className="btn-close btn-close-white box-content w-4 h-4 ml-2 text-white border-none rounded-none opacity-50 focus:shadow-none focus:outline-none active:opacity-100 hover:text-white hover:opacity-75 hover:no-underline"
            data-mdb-dismiss="toast"
            aria-label="Close"
            onClick={dismiss}
          >
            <HiX size="1.2em" />
          </button>
        </div>
      </div>
      <div className="p-3 bg-red-400 rounded-b-lg break-words text-white overflow-y-scroll max-h-96">
        {message}
      </div>
    </div>
  );
};

export default Toast;
