"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { type SignInState, signIn } from "../actions";

const initial: SignInState = { error: null };

export function SignInForm() {
	const [state, action, pending] = useActionState(signIn, initial);

	return (
		<form action={action} className="flex flex-col gap-6">
			<FieldGroup>
				<Field data-disabled={pending}>
					<FieldLabel htmlFor="email">Email</FieldLabel>
					<Input
						autoComplete="username"
						disabled={pending}
						id="email"
						name="email"
						required
						type="email"
					/>
				</Field>
				<Field data-disabled={pending}>
					<FieldLabel htmlFor="password">Password</FieldLabel>
					<Input
						autoComplete="current-password"
						disabled={pending}
						id="password"
						name="password"
						required
						type="password"
					/>
				</Field>
			</FieldGroup>
			<Button disabled={pending} type="submit">
				{pending && <Spinner data-icon="inline-start" />}
				{pending ? "Signing in…" : "Sign in"}
			</Button>
			<div aria-live="polite">
				{state.error && (
					<Alert variant="destructive">
						<AlertTitle>Unable to sign in</AlertTitle>
						<AlertDescription>{state.error}</AlertDescription>
					</Alert>
				)}
			</div>
		</form>
	);
}
