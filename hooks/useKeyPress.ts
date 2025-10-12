import { useEffect } from "react";

interface UseKeyPressOptions {
  keys: string[]; // 支持多个按键
  onKeyPress: (event: KeyboardEvent) => void; // 当按键按下时的回调函数，接受事件参数
  withCtrlOrMeta?: boolean; // 是否需要与 Ctrl 或 Meta 键组合，默认为 false
  isActive?: boolean; // 是否激活监听，默认为 true
}

const useKeyPress = ({
  keys,
  onKeyPress,
  withCtrlOrMeta = false,
  isActive = true,
}: UseKeyPressOptions) => {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isCorrectModifierPressed = withCtrlOrMeta
        ? event.ctrlKey || event.metaKey
        : true;
      if (isCorrectModifierPressed && keys.includes(event.key)) {
        onKeyPress(event);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, keys, withCtrlOrMeta, onKeyPress]);
};

export default useKeyPress;
