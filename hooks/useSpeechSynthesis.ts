import { useState } from "react";

export const useSpeechSynthesis = () => {
  const [speechRate, setSpeechRate] = useState(1); // 默认正常速度

  const speak = (
    content: string,
    lang: string = "zh-TW",
    rate: number = speechRate
  ) => {
    const synth = window.speechSynthesis;
    // 在开始新的语音合成之前，先取消当前的语音合成
    synth.cancel(); // 确保在开始新的语音合成前取消当前的语音合成
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = lang;
    utterance.rate = rate;

    synth.speak(utterance);
  };

  const cancel = () => {
    window.speechSynthesis.cancel();
  };

  return { speak, cancel, speechRate, setSpeechRate };
};
