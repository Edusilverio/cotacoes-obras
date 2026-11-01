import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


interface DateInputProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
}

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  return parts.join("/");
}

function parseDate(text: string): Date | null {
  if (text.length !== 10) return null;
  const parsed = parse(text, "dd/MM/yyyy", new Date());
  if (!isValid(parsed)) return null;
  if (format(parsed, "dd/MM/yyyy") !== text) return null;
  return parsed;
}

export function DateInput({
  value,
  onChange,
  disabled,
  id,
  className,
  placeholder = "dd/mm/aaaa",
}: DateInputProps) {
  const [text, setText] = React.useState(() =>
    value ? format(value, "dd/MM/yyyy") : "",
  );
  const [open, setOpen] = React.useState(false);
  const lastValueRef = React.useRef<Date | undefined>(value);

  React.useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      setText(value ? format(value, "dd/MM/yyyy") : "");
    }
  }, [value]);

  const isInvalid = text.length > 0 && parseDate(text) === null;

  const handleTextChange = (raw: string) => {
    const masked = maskDate(raw);
    setText(masked);
    if (masked === "") {
      lastValueRef.current = undefined;
      onChange(undefined);
      return;
    }
    const parsed = parseDate(masked);
    if (parsed) {
      lastValueRef.current = parsed;
      onChange(parsed);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("flex items-center gap-2", className)}>
          <Input
            id={id}
            inputMode="numeric"
            placeholder={placeholder}
            value={text}
            disabled={disabled}
            onChange={(e) => handleTextChange(e.target.value)}
            className={cn(
              "flex-1",
              isInvalid && "border-destructive focus-visible:ring-destructive",
            )}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label="Abrir calendário"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[300px] p-0 pointer-events-auto"
        align="end"
        side="bottom"
        sideOffset={8}
      >
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={(d) => {
            lastValueRef.current = d;
            setText(d ? format(d, "dd/MM/yyyy") : "");
            onChange(d);
            setOpen(false);
          }}
          initialFocus
          fixedWeeks
          showOutsideDays
          locale={ptBR}
          className="p-3 pointer-events-auto w-[300px]"
          classNames={{
            months: "flex flex-col",
            month: "space-y-4 w-full",
            table: "w-full border-collapse",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md w-9 flex-1 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "flex-1 h-9 text-center text-sm p-0 relative",
            day: "h-9 w-9 mx-auto p-0 font-normal aria-selected:opacity-100",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

