import "~/styles/globals.css";

import type { Metadata } from "next";
import { Figtree, IBM_Plex_Mono, Nunito_Sans } from "next/font/google";
import { cn } from "~/lib/utils";

const figtreeHeading = Figtree({
	subsets: ["latin"],
	variable: "--font-display",
});

const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
	title: "Open Shuttle — Queensland badminton results",
	description:
		"A public API and results explorer for Queensland badminton tournaments.",
	icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

const mono = IBM_Plex_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
	variable: "--font-code",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			className={cn(
				"dark font-sans",
				mono.variable,
				nunitoSans.variable,
				figtreeHeading.variable,
			)}
			lang="en"
		>
			<body>{children}</body>
		</html>
	);
}
