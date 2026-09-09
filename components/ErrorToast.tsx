import { AlertCircle, X } from 'lucide-react';

type ErrorToastProps = {
  errorMessage: string;
  onDismiss: () => void;
};
const ErrorToast = ({ errorMessage, onDismiss }: ErrorToastProps) => {
  return (
        <div
          id="global-error-toast"
          className="bg-red-50 border-b border-red-200 text-red-800 px-4 py-2 text-xs flex items-center justify-between z-30 shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={onDismiss}
            className="text-red-600 hover:text-red-900 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
};

export default ErrorToast;