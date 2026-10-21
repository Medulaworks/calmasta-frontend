import { Extension } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { UNCERTAIN } from "@/lib/uncertainty";

/** Highlights "Not specified" and friends in the editor. A display effect only: it never changes the document. */
export const UncertaintyHighlight = Extension.create({
  name: "uncertaintyHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const found: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const m of node.text.matchAll(new RegExp(UNCERTAIN.source, "gi"))) {
                const from = pos + (m.index ?? 0);
                found.push(Decoration.inline(from, from + m[0].length, { class: "uncertain" }));
              }
            });
            return DecorationSet.create(state.doc, found);
          },
        },
      }),
    ];
  },
});
