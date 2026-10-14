import { ClearIcon, SearchIcon } from "@intel-enterprise-rag-ui/icons";
import { cn } from "@intel-enterprise-rag-ui/utils";
import debounce from "lodash.debounce";
import {
  ChangeEvent,
  HTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";

const DEBOUNCE_MS = 100;

interface SearchBarProps extends Omit<
  HTMLAttributes<HTMLInputElement>,
  "onChange"
> {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export const SearchBar = ({
  value,
  className,
  placeholder,
  onChange,
}: SearchBarProps) => {
  const [inner, setInner] = useState(value);

  useEffect(() => setInner(value), [value]);

  const debouncedOnChange = useMemo(
    () => debounce((newValue: string) => onChange(newValue), DEBOUNCE_MS),
    [onChange],
  );

  useEffect(() => {
    debouncedOnChange(inner);
  }, [inner, debouncedOnChange]);

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    setInner(e.target.value);
  };

  const handleClear = () => {
    setInner("");
    debouncedOnChange("");
  };

  return (
    <div
      className={cn(
        "border-input bg-background focus-within:outline-ring flex h-8 w-full max-w-[350px] items-center gap-2 rounded-lg border px-[10px] py-[6px] focus-within:outline focus-within:outline-2",
        className,
      )}
    >
      <SearchIcon
        size={9}
        className="text-foreground flex h-3 w-3 flex-shrink-0 items-center justify-center"
      />
      <input
        type="text"
        className="text-foreground caret-foreground placeholder:text-muted-foreground m-0 flex-1 appearance-none border-0 bg-transparent p-0 text-xs leading-[1.6] shadow-none outline-none placeholder:not-italic placeholder:opacity-90 focus:border-none! focus:shadow-none! focus:outline-none! focus:placeholder:text-transparent"
        placeholder={placeholder}
        value={inner}
        aria-label="Global table search"
        onChange={onInput}
      />
      {inner && (
        <ClearIcon
          size={9}
          className="text-foreground flex h-3 w-3 flex-shrink-0 cursor-pointer items-center justify-center hover:opacity-70"
          onClick={handleClear}
        />
      )}
    </div>
  );
};
