// src/types/global.d.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  // 브라우저에 존재할 수 있는 전역 객체들
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    /** widget.js가 중복 로드를 막으려고 세우는 플래그. */
    __chatbase_loaded?: boolean;
  }

  var webkitSpeechRecognition: any;
  var SpeechRecognition: any;
}

export {};
