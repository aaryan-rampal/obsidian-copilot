jest.mock("obsidian", () => {
  class MockMarkdownView {
    editor: unknown;

    constructor(editor?: unknown) {
      this.editor = editor;
    }

    getState() {
      return {};
    }
  }

  return {
    MarkdownView: MockMarkdownView,
    Notice: jest.fn(),
    TFile: class MockTFile {},
    Vault: class MockVault {},
    normalizePath: jest.fn((path: string) => path),
    requestUrl: jest.fn(),
  };
});

jest.mock("@/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

import { MarkdownView, Notice } from "obsidian";
import { insertIntoEditor, preserveBlockquotePrefix } from "./utils";

interface EditorPosition {
  line: number;
  ch: number;
}

/**
 * Test editor that implements the small subset of Obsidian editor behavior
 * used by insertIntoEditor.
 */
class MockEditor {
  doc: string;
  selectionFrom: EditorPosition;
  selectionTo: EditorPosition;
  focus = jest.fn();
  cm: {
    state: {
      doc: Record<string, never>;
      selection: { main: { from: number; to: number } };
      toText: (text: string) => string;
    };
    dispatch: jest.Mock;
  };

  constructor(
    doc: string,
    selectionFrom: EditorPosition,
    selectionTo: EditorPosition = selectionFrom
  ) {
    this.doc = doc;
    this.selectionFrom = { ...selectionFrom };
    this.selectionTo = { ...selectionTo };
    this.cm = {
      state: {
        doc: {},
        selection: {
          main: {
            from: this.posToOffset(this.selectionFrom),
            to: this.posToOffset(this.selectionTo),
          },
        },
        toText: (text: string) => text,
      },
      dispatch: jest.fn(
        (transaction: {
          changes: { from: number; to: number; insert: string };
          selection?: { anchor: number; head: number };
        }) => {
          const { from, to, insert } = transaction.changes;
          this.doc = `${this.doc.slice(0, from)}${insert}${this.doc.slice(to)}`;

          if (transaction.selection) {
            this.selectionFrom = this.offsetToPos(transaction.selection.anchor);
            this.selectionTo = this.offsetToPos(transaction.selection.head);
          }

          this.syncSelectionState();
        }
      ),
    };
  }

  /**
   * Returns the requested cursor endpoint.
   */
  getCursor(which: "from" | "to"): EditorPosition {
    return which === "from" ? { ...this.selectionFrom } : { ...this.selectionTo };
  }

  /**
   * Returns a single document line.
   */
  getLine(line: number): string {
    return this.doc.split("\n")[line] ?? "";
  }

  /**
   * Replaces a text range with new content.
   */
  replaceRange(text: string, from: EditorPosition, to: EditorPosition): void {
    const start = this.posToOffset(from);
    const end = this.posToOffset(to);
    this.doc = `${this.doc.slice(0, start)}${text}${this.doc.slice(end)}`;
    this.syncSelectionState();
  }

  /**
   * Updates the editor selection.
   */
  setSelection(from: EditorPosition, to: EditorPosition): void {
    this.selectionFrom = { ...from };
    this.selectionTo = { ...to };
    this.syncSelectionState();
  }

  /**
   * Converts a line/ch position to a document offset.
   */
  private posToOffset(position: EditorPosition): number {
    const lines = this.doc.split("\n");
    let offset = 0;

    for (let index = 0; index < position.line; index += 1) {
      offset += (lines[index]?.length ?? 0) + 1;
    }

    return offset + position.ch;
  }

  /**
   * Converts a document offset back to a line/ch position.
   */
  private offsetToPos(offset: number): EditorPosition {
    const lines = this.doc.split("\n");
    let remaining = offset;

    for (let index = 0; index < lines.length; index += 1) {
      const lineLength = lines[index]?.length ?? 0;
      if (remaining <= lineLength) {
        return { line: index, ch: remaining };
      }
      remaining -= lineLength + 1;
    }

    return {
      line: Math.max(lines.length - 1, 0),
      ch: lines[lines.length - 1]?.length ?? 0,
    };
  }

  /**
   * Keeps the CM6 selection mirror aligned with the current editor selection.
   */
  private syncSelectionState(): void {
    this.cm.state.selection.main = {
      from: this.posToOffset(this.selectionFrom),
      to: this.posToOffset(this.selectionTo),
    };
  }
}

describe("preserveBlockquotePrefix", () => {
  it("continues the current blockquote prefix across multiline inserts", () => {
    const message = "First line\n\n### Heading\nBody";

    expect(preserveBlockquotePrefix(message, "> ")).toBe("First line\n> \n> ### Heading\n> Body");
  });

  it("leaves non-blockquote lines unchanged", () => {
    const message = "First line\nSecond line";

    expect(preserveBlockquotePrefix(message, "Regular text")).toBe(message);
  });
});

describe("insertIntoEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps multiline replacements inside an existing callout blockquote", async () => {
    const editor = new MockEditor("> [!ai]- \n> X", { line: 1, ch: 2 }, { line: 1, ch: 3 });
    const leaf = {
      view: new (MarkdownView as unknown as { new (editor: MockEditor): unknown })(editor),
    };

    (global as any).app = {
      workspace: {
        getMostRecentLeaf: jest.fn(() => leaf),
        getLeaf: jest.fn(() => leaf),
      },
    } as any;

    await insertIntoEditor(
      `The mechanism behind Unified Memory relies on a combination of hardware support.

### 1. Page Faulting Mechanism
When you allocate memory using \`cudaMallocManaged\`, the CUDA runtime does not immediately copy the entire data set to the GPU.`,
      true
    );

    expect(editor.doc).toBe(
      `> [!ai]- 
> The mechanism behind Unified Memory relies on a combination of hardware support.
> 
> ### 1. Page Faulting Mechanism
> When you allocate memory using \`cudaMallocManaged\`, the CUDA runtime does not immediately copy the entire data set to the GPU.`
    );
    expect(Notice).toHaveBeenCalledWith("Message inserted into the active note.");
  });
});
