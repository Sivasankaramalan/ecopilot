import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  base: "/ecopilot",
  integrations: [
    starlight({
      title: "EcoPilot",
      description: "Stop burning Copilot premium requests. Human-in-the-loop MCP tools + prompt hygiene for VS Code.",
      social: {
        github: "https://github.com/Sivasankaramalan/ecopilot",
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Quick Start", link: "/guides/quickstart" },
            { label: "How It Works", link: "/guides/how-it-works" },
          ],
        },
        {
          label: "Tool Reference",
          items: [
            { label: "Human-in-the-Loop", link: "/reference/hitl-tools" },
            { label: "Prompt Hygiene", link: "/reference/hygiene-tools" },
            { label: "Memory", link: "/reference/memory-tools" },
            { label: "Model Guard", link: "/reference/model-guard" },
            { label: "Savings Report", link: "/reference/savings-report" },
          ],
        },
        {
          label: "Savings Calculator",
          items: [
            { label: "Token Savings Calculator", link: "/calculator" },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],
});
