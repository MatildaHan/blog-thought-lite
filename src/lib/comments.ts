/** Shared by the static front end and Cloudflare Pages Functions. */
export interface CommentUser {
	id: string;
	handle: string;
	name: string;
	avatarUrl: string;
	description: string;
	homepage: string;
	isAuthor: boolean;
}

export interface CommentItem {
	id: string;
	nickname: string;
	content: string;
	createdAt: string;
	parentId: string | null;
	parentNickname: string | null;
	user: CommentUser | null;
}

export interface CommentPage {
	comments: CommentItem[];
	nextCursor: string | null;
	siteKey: string;
	ready: boolean;
	user: CommentUser | null;
	githubEnabled: boolean;
}

export function commentLength(value: string): number {
	return Array.from(value).length;
}

/** Never let a malformed configuration accidentally disable length validation. */
export function maxCommentLength(value: number | undefined): number {
	return Number.isInteger(value) && value! > 0 ? Math.min(value!, 5000) : 500;
}
