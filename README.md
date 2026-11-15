# Pyxis by RevoRed

Pyxis is a Mars field atlas for the 2026 NASA Space Apps Challenge. Explore the
surface in 3D, compare terrain-aware EVA routes, and plan field missions.

## Start here

- [Open the web atlas](https://mars-field-atlas.vercel.app/)
- [Run the web app locally](apps/web/README.md#development)
- [Explore the architecture and datasets](docs/PROJECT_ARCHITECTURE_AND_TECHNOLOGY_STACK.md)

## Repository layout

| Path | Contents |
| --- | --- |
| [`apps/web/`](apps/web/) | Mars atlas, web APIs, and Vercel configuration |
| [`apps/desktop/`](apps/desktop/) | Reserved for the Linux desktop app and map package manager |
| [`packages/algorithms/`](packages/algorithms/) | Python navigation prototype |
| [`packages/data/`](packages/data/) | Data contracts, samples, and training datasets |
| [`docs/`](docs/) | Architecture and mission documentation |
| [`tools/`](tools/) | Data preparation, model training, and asset scripts |
| [`.github/workflows/`](.github/workflows/) | Web tests and build checks |

When connecting this repository to Vercel, set the project's Root Directory to
`apps/web`.

## Desktop downloads

[Windows and Linux ARM64 installers](https://github.com/Harshvardhan226510/NASA-2026-mars/releases/latest) · [Desktop setup and API guides](apps/desktop/README.md).
