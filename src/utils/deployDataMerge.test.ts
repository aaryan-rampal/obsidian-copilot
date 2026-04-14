import { mergeDeployData } from "../../scripts/deployUtils.cjs";

describe("mergeDeployData", () => {
  test("preserves existing settings while overriding only provided deploy keys", () => {
    const existingData = {
      plusLicenseKey: "",
      openRouterAiApiKey: "encrypted-key",
      activeModels: [{ name: "gemini", provider: "openrouterai", enabled: true }],
      enableSelfHostMode: false,
      selfHostSearchProvider: "firecrawl",
      braveApiKey: "",
    };

    const overrideData = {
      plusLicenseKey: "local-dev",
      enableSelfHostMode: true,
      selfHostSearchProvider: "brave",
      braveApiKey: "test-brave-key",
    };

    const mergedData = mergeDeployData(existingData, overrideData);

    expect(mergedData).toEqual({
      plusLicenseKey: "local-dev",
      openRouterAiApiKey: "encrypted-key",
      activeModels: [{ name: "gemini", provider: "openrouterai", enabled: true }],
      enableSelfHostMode: true,
      selfHostSearchProvider: "brave",
      braveApiKey: "test-brave-key",
    });
  });
});
