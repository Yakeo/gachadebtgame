CREATE TABLE "auth_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_saves" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"password_hash" text,
	"google_id" text,
	"name" text DEFAULT 'President' NOT NULL,
	"guest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_users_email_unique" UNIQUE("email"),
	CONSTRAINT "game_users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "game_saves" ADD CONSTRAINT "game_saves_user_id_game_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."game_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_game_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."game_users"("id") ON DELETE cascade ON UPDATE no action;