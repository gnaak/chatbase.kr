import type { Options } from "react-markdown";
import remarkGfm from "remark-gfm";

type RemarkPlugin = NonNullable<Options["remarkPlugins"]>[number];

/**
 * 한국어 답변용 GFM 설정. 채팅 답변을 그리는 곳은 전부 이걸 쓴다.
 *
 * GFM은 물결표 하나로 감싼 `~텍스트~`를 취소선으로 읽는다. 그런데 한국어는
 * 물결표를 범위 기호로 쓴다 — `14:00~22:00`, `고1~고3`, `3~5개`.
 * 기본값이면 "평일 14:00~22:00, 토요일 10:00~18:00" 같은 안내에서
 * 두 물결표 사이가 통째로 줄 그어진 채 방문자에게 나간다.
 * LLM 답변에 이 표기가 수시로 나오므로 끄는 쪽이 맞다.
 *
 * 물결표 두 개(`~~취소선~~`)는 그대로 동작한다.
 */
export const remarkGfmKo: RemarkPlugin = [remarkGfm, { singleTilde: false }];
