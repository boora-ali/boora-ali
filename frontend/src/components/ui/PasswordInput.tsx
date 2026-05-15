import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, Props>((props, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup>
      <InputGroupInput ref={ref} type={visible ? "text" : "password"} {...props} />
      <InputGroupAddon align="inline-end">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex h-full items-center px-3 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </InputGroupAddon>
    </InputGroup>
  );
});
PasswordInput.displayName = "PasswordInput";
