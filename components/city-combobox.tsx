"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A text box that suggests US cities from /api/cities as you type. The text
 * itself is the value (submitted under `name`, if given); the server turns it
 * into a canonical "City, ST" or rejects it, so picking a suggestion is the
 * easy path, not the only one.
 */
export function CityCombobox({
  name,
  defaultValue = "",
  onChange,
  onCommit,
  placeholder = "Home city (e.g. Austin, TX)",
  className,
  disabled,
  required,
  autoFocus,
  "aria-label": ariaLabel = "Home city",
}: {
  name?: string;
  defaultValue?: string;
  /** Every change to the text. */
  onChange?: (value: string) => void;
  /** A suggestion was picked, or the text was edited and the box left. */
  onCommit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
}) {
  const listId = useId();
  const [text, setText] = useState(defaultValue);
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // The text as of the last commit, so leaving the box unchanged is a no-op.
  const committed = useRef(defaultValue);

  // Fetch suggestions for the current text while the list is open. Each
  // request cancels the one before it, so stale results never land.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/cities?q=${encodeURIComponent(text)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((list: string[]) => {
          setOptions(list);
          setActive(-1);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, open]);

  function change(value: string) {
    setText(value);
    setOpen(true);
    onChange?.(value);
  }

  function commit(value: string) {
    setOpen(false);
    if (value === committed.current) return;
    committed.current = value;
    onCommit?.(value);
  }

  function pick(value: string) {
    setText(value);
    onChange?.(value);
    commit(value);
  }

  const showList = open && options.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        name={name}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => change(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!showList) {
              setOpen(true);
              return;
            }
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (i + step + options.length) % options.length);
          } else if (e.key === "Enter" && showList && active >= 0) {
            // Picks the highlighted city instead of submitting the form.
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Enter" && onCommit) {
            e.preventDefault();
            commit(text);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`w-full ${className ?? ""}`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 min-w-48 overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm text-zinc-950 shadow-lg"
        >
          {options.map((option, i) => (
            <li
              key={option}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: it fires before the input's blur.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? "bg-zinc-100" : ""}`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
