import type { ReactNode } from "react";
import type { PlaygroundValues, PreviewEnv } from "~/components/playground/playground";

/** Client-side counterpart of a component's meta: the parts that render. */
export interface LiveModule {
  renderPlayground: (values: PlaygroundValues, env: PreviewEnv) => ReactNode;
  /** Small live preview for catalog cards. */
  cardPreview: () => ReactNode;
  /** Example renderers keyed by `ExampleDoc.id`. */
  examples: Record<string, () => ReactNode>;
}
