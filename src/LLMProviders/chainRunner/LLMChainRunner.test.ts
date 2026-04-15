jest.mock("@/context/LayerToMessagesConverter", () => ({
  LayerToMessagesConverter: {
    convert: jest.fn(),
  },
}));

jest.mock("@/logger", () => ({
  logInfo: jest.fn(),
}));

jest.mock("@/settings/model", () => ({
  getSettings: jest.fn().mockReturnValue({ activeModels: [] }),
}));

jest.mock("@/tools/SearchTools", () => ({
  webSearchTool: {},
}));

jest.mock("@/tools/toolManager", () => ({
  ToolManager: {
    callTool: jest.fn(),
  },
}));

jest.mock("@/tools/ToolResultFormatter", () => ({
  ToolResultFormatter: {
    format: jest.fn(),
  },
}));

jest.mock("./utils/chatHistoryUtils", () => ({
  loadAndAddChatHistory: jest.fn().mockResolvedValue([]),
}));

jest.mock("./utils/promptPayloadRecorder", () => ({
  recordPromptPayload: jest.fn(),
}));

jest.mock("./utils/ThinkBlockStreamer", () => ({
  ThinkBlockStreamer: jest.fn(),
}));

jest.mock("./utils/webCommandUtils", () => ({
  buildWebSearchContextMessage: jest.fn(),
  hasWebCommand: jest.fn(),
  removeWebCommands: jest.fn(),
}));

jest.mock("@/aiParams", () => ({
  getModelKey: jest.fn().mockReturnValue("test-model"),
}));

jest.mock("@/utils", () => ({
  extractChatHistory: jest.fn(),
  findCustomModel: jest.fn().mockReturnValue({ capabilities: [] }),
  withSuppressedTokenWarnings: jest.fn((fn: () => unknown) => fn()),
}));

import { LayerToMessagesConverter } from "@/context/LayerToMessagesConverter";
import { PromptContextEnvelope } from "@/context/PromptContextTypes";
import { ChatMessage } from "@/types/message";
import { LLMChainRunner } from "./LLMChainRunner";

describe("LLMChainRunner", () => {
  const mockConvert = LayerToMessagesConverter.convert as jest.Mock;

  const createEnvelope = (l5Text: string): PromptContextEnvelope => ({
    version: 1,
    conversationId: null,
    messageId: "msg-1",
    layers: [
      {
        id: "L3_TURN",
        label: "Current Turn Context",
        text: "<selected_text>\n<content>CUDA selection</content>\n</selected_text>",
        stable: false,
        segments: [],
        hash: "l3-hash",
      },
      {
        id: "L5_USER",
        label: "User Message",
        text: l5Text,
        stable: false,
        segments: [],
        hash: "l5-hash",
      },
    ],
    serializedText: "",
    layerHashes: {
      L1_SYSTEM: "l1",
      L2_PREVIOUS: "l2",
      L3_TURN: "l3",
      L4_STRIP: "l4",
      L5_USER: "l5",
    },
    combinedHash: "combined",
  });

  const createRunner = () =>
    new LLMChainRunner({
      memoryManager: {
        getMemory: jest.fn().mockReturnValue({}),
      },
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should preserve merged context when applying a cleaned @web user override", async () => {
    mockConvert.mockReturnValue([
      { role: "system", content: "System prompt" },
      {
        role: "user",
        content:
          "Context attached to this message:\n- selected_text\n\nFind them in the Context Library in the system prompt above.\n\n---\n\n[User query]:\n\n@web tell me what this is?",
      },
    ]);

    const runner = createRunner();
    const message: ChatMessage = {
      message: "@web tell me what this is?",
      sender: "user",
      timestamp: null,
      isVisible: true,
      contextEnvelope: createEnvelope("@web tell me what this is?"),
    };

    const messages = await (runner as any).constructMessages(message, "tell me what this is?", [
      { role: "system", content: "web results" },
    ]);

    expect(messages).toHaveLength(3);
    expect(messages[2].role).toBe("user");
    expect(messages[2].content).toContain("Context attached to this message");
    expect(messages[2].content).toContain("[User query]:");
    expect(messages[2].content).toContain("tell me what this is?");
    expect(messages[2].content).not.toContain("@web tell me what this is?");
  });

  it("should replace the full user message when there is no merged context prefix", async () => {
    mockConvert.mockReturnValue([{ role: "user", content: "@web latest obsidian release" }]);

    const runner = createRunner();
    const message: ChatMessage = {
      message: "@web latest obsidian release",
      sender: "user",
      timestamp: null,
      isVisible: true,
      contextEnvelope: createEnvelope("@web latest obsidian release"),
    };

    const messages = await (runner as any).constructMessages(message, "latest obsidian release");

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      role: "user",
      content: "latest obsidian release",
    });
  });
});
