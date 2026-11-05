# Tabletop

[日本語](README.md)

**A shared workbench for humans and AI. Spread out your material, arrange it, connect it, and think together.**

Write an idea on a card. Sketch a shape that is hard to put into words. Place related things nearby and connect them with lines.

Then ask your AI:

**“Make these cards easier to read.”**

Tabletop is a browser-based desk that you and your AI can both read and edit. The AI uses MCP; your conversation stays in your usual AI chat. The contents and arrangement of the desk become shared references for the discussion.

> English support is being developed for v0.1.1 on `develop`. The published v0.1.0 release and current public tutorial predate this work. This document does not announce a new release.

## Try a desk

**[Open the tutorial desk — Japanese](https://zuntan.github.io/tabletop/?desk=desks/tabletop-guide.tabletop)**

Try the tools and real examples in your browser without installing anything. Select a green wayfinder and press the ▶ button that appears to follow its route through the desk.

The public page does not connect to AI. To work with your AI on your own desk, install the normal edition and register its MCP server. An English tutorial desk is still to come.

You can also [read the Japanese introduction as a desk](https://zuntan.github.io/tabletop/?desk=desks/README.tabletop).

## Place things by hand, ask AI, then adjust them yourself

Put cards, images, shapes, Mermaid diagrams, links and freehand doodles anywhere on a large desk. Bundle material with clips or clear files, arrange cards along rulers, and add stamps or stickers.

Do everything yourself, or hand over part of the work:

**“Split this text into cards by topic. Keep the original.”**

Move the cards your AI creates, mark something that catches your attention, and discuss it again.

**“Draw a diagram of this relationship.”**

Look at the alternatives together, draw a connection or add a sketch to show what you mean.

**“Arrange the selected cards in a row.”**

Decide how much to delegate each time. You do not need to describe every detail in words, and the AI does not need to decide everything.

The [workflow](docs/images/tabletop-workflow.svg) and [collaboration sequence](docs/images/tabletop-collaboration.svg) diagrams are examples from the tutorial; their labels are currently Japanese.

## Start using your desk with AI

Install the normal edition on your PC and register Tabletop with an AI agent that supports local stdio MCP. Then ask:

**“Open a Tabletop desk.”**

See **[INSTALL_en.md](INSTALL_en.md)** for installation, MCP setup, first connection and reconnection.

Save a desk as a `.tabletop` file to continue later. You can ask the AI to save it too:

**“Save this desk to …”**

Export PDF or PNG for use elsewhere. The static Pages edition lets people open a desk by URL, view it and make basic edits without an AI connection.

## Language

On the v0.1.1 development version, choose **Menu → Language… → English / 日本語**. The first launch uses Japanese for a Japanese browser language, and English otherwise. Your explicit choice is stored in the browser, independently of the desk file.

Changing the UI language does not translate existing cards, names, Mermaid source or other saved content. Japanese stamp artwork remains Japanese; tooltips and the MCP catalog explain its meaning in English. New default names use the language active when they are created.

## Before you use it

**There is no autosave. Save before closing or reloading a desk.**

The developers use Tabletop with Codex, Copilot and pi. The model used for testing is **GPT-6.1-Sol** only. Other agents or models have not been verified.

AI decisions, actions and results can differ. Identical behavior or results are not guaranteed.

## Read when needed

- [Documentation guide](docs/en/README.md)
- [The idea behind the desk](docs/en/tabletop-philosophy.md)
- [Basic operations and desk tools](docs/en/authoring.md)
- [Shapes, lines and connections](docs/en/diagram.md)
- [Working with AI](docs/en/ai-interface.md)
- [Using and publishing static Pages](docs/en/pages.md)
- [Touring the Japanese tutorial](docs/en/tutorial.md)

## License

Tabletop is released under the [MIT License](LICENSE). Copyright © 2026 zuntan.

Bundled libraries and assets have their own licenses; see the [third-party notices](public/licenses/THIRD_PARTY_NOTICES.txt). Rights to images and material you bring to the desk are separate from Tabletop's license.
