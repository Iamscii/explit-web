// Letter.tsx
import React, { useState, useEffect, useRef } from "react";

export type LetterState = "normal" | "correct" | "wrong";
import "./Letter.css";

interface LetterProps {
  letter: string;
  index: number;
  state: LetterState;
  onInput: (index: number, value: string) => void;
  visible: boolean;
}

const Letter: React.FC<LetterProps> = ({
  letter,
  index,
  state,
  onInput,
  visible,
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const handleFocus = () => setEditing(true);
  const handleBlur = () => setEditing(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInput(index, e.target.value);
    setEditing(false); // 完成输入后不再编辑
  };

  const stateClassNameMap: Record<LetterState, string> = {
    normal: "text-gray-400",
    correct: "text-green-400",
    wrong: "text-red-400 wrong",
  };
  const normalStyle =
    "m-0 p-1 text-4xl font-mono font-normal dark:text-green-400 pr-0.8 duration-0 dark:text-opacity-80";

    return (
      <span
        onClick={handleFocus}
        className={`${normalStyle} ${stateClassNameMap[state]}`}
        style={{
          position: "relative",
          display: "inline-block",
        }}
      >
        {editing ? (
          visible ? (
            <input
              ref={inputRef}
              type="text"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                opacity: 0,
                height: "100%",
                width: "100%",
              }}
              onBlur={handleBlur}
              onChange={handleChange}
              maxLength={1}
            />
          ) : (
            "_"
          )
        ) : letter === " " ? (
          <div style={{ display: "inline-block", width: "16px", borderBottom: "1px solid black" }}></div> // 这里是对空格的特殊处理
        ) : (
          letter
        )}
      </span>
    );
    
};

export default React.memo(Letter);
