import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

// =============================================================================
// tomatime "clay" theme (Warm Claymorphism)
// Source of truth: demo/clay-pomodoro-design.html. Components reference these
// tokens as `clay.*` / `tomato.*` / etc. The DUAL clay shadows are the
// signature of this theme and live as custom `shadows.*` tokens — the one place
// we deliberately step outside Chakra's default shadow scale.
// =============================================================================
const config = defineConfig({
	theme: {
		tokens: {
			colors: {
				clay: {
					// palette — tomato-red leads; warm cream neutrals
					tomato600: { value: "#E23B2E" }, // primary accent — bold tomato
					tomato500: { value: "#F04A3A" }, // hover / lighter accent
					tomato700: { value: "#C42E22" }, // pressed accent
					tomato100: { value: "#FCE3DF" }, // tinted clay fill (active tab, chips)

					basil500: { value: "#3FAE6A" }, // break / success green
					basil600: { value: "#2F9658" },
					basil100: { value: "#DDF1E4" },

					creamBg: { value: "#F6EDE3" }, // warm page background — never pure white
					surface: { value: "#FBF4EC" }, // raised clay surface (cards, buttons)
					surfaceHi: { value: "#FFFDFB" }, // lightest highlight surface
					press: { value: "#EFE3D6" }, // recessed / pressed clay fill

					ink900: { value: "#3A2E27" }, // primary text — warm dark brown
					ink600: { value: "#8A7A6E" }, // muted text
					ink400: { value: "#B6A698" }, // placeholder / disabled text

					line: { value: "#E7D8C8" }, // hairline divider on cream
				},
			},
			fonts: {
				// Nunito for display/headings, DM Sans for body/UI text.
				heading: { value: "'Nunito', system-ui, sans-serif" },
				body: { value: "'DM Sans', system-ui, sans-serif" },
			},
			radii: {
				// chunky clay corner radii
				clayPill: { value: "999px" },
				clayLg: { value: "32px" }, // big clay panels
				clayMd: { value: "24px" }, // cards, inputs
				claySm: { value: "16px" }, // small controls
			},
			shadows: {
				// DUAL CLAY SHADOWS — soft warm drop (bottom-right) + light
				// highlight (top-left), plus inner shadows for extruded depth.
				clayRaised: {
					value:
						"8px 8px 20px rgba(180, 120, 90, 0.28), -8px -8px 18px rgba(255, 253, 250, 0.90), inset 2px 2px 4px rgba(255, 255, 255, 0.55), inset -3px -3px 6px rgba(180, 120, 90, 0.12)",
				},
				clayPressed: {
					value:
						"inset 5px 5px 12px rgba(180, 120, 90, 0.30), inset -5px -5px 12px rgba(255, 253, 250, 0.85)",
				},
				claySoft: {
					value:
						"5px 5px 14px rgba(180, 120, 90, 0.20), -5px -5px 12px rgba(255, 253, 250, 0.85)",
				},
				// tomato CTA shadow — a red surface needs a red-tinted shadow
				tomatoRaised: {
					value:
						"7px 7px 18px rgba(196, 46, 34, 0.40), -6px -6px 14px rgba(255, 180, 170, 0.55), inset 2px 2px 4px rgba(255, 255, 255, 0.35), inset -3px -3px 7px rgba(150, 30, 20, 0.35)",
				},
			},
		},
		semanticTokens: {
			colors: {
				// convenience aliases so components read `bg="clay.bg"` etc.
				"clay.bg": { value: "{colors.clay.creamBg}" },
				"clay.fg": { value: "{colors.clay.ink900}" },
				"clay.fgMuted": { value: "{colors.clay.ink600}" },
				"clay.fgSubtle": { value: "{colors.clay.ink400}" },
			},
		},
	},
	globalCss: {
		"html, body": {
			fontFamily: "body",
			color: "clay.ink900",
			background: "clay.creamBg",
			// subtle warm radial wash so the cream is never flat
			backgroundImage:
				"radial-gradient(circle at 20% 0%, #FBF1E7 0%, transparent 45%), radial-gradient(circle at 100% 100%, #F3E6D7 0%, transparent 40%)",
			backgroundAttachment: "fixed",
			minHeight: "100dvh",
		},
	},
});

export const system = createSystem(defaultConfig, config);
