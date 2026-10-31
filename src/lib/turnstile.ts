interface Turnstile {
	render: (
		element: HTMLElement,
		options: {
			sitekey: string;
			action: string;
			theme: "auto";
			callback: (token: string) => void;
			"expired-callback": () => void;
			"error-callback": () => void;
		}
	) => string;
	reset: (id: string) => void;
	remove: (id: string) => void;
}

declare global {
	interface Window {
		turnstile?: Turnstile;
	}
}

let loading: Promise<Turnstile> | undefined;

/** Loaded only on enabled comment pages, shared across Swup navigations. */
export function loadTurnstile(): Promise<Turnstile> {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	if (!loading) {
		loading = new Promise<Turnstile>((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
			script.async = true;
			const timer = setTimeout(() => {
				script.remove();
				reject(new Error("Turnstile timeout"));
			}, 15000);
			script.onload = () => {
				clearTimeout(timer);
				if (window.turnstile) resolve(window.turnstile);
				else reject(new Error("Turnstile unavailable"));
			};
			script.onerror = () => {
				clearTimeout(timer);
				script.remove();
				reject(new Error("Turnstile unavailable"));
			};
			document.head.append(script);
		}).catch(error => {
			loading = undefined;
			throw error;
		});
	}
	return loading;
}
