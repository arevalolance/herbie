-- Add session_notes table to capture structured setup notes per session
CREATE TABLE "session_notes" (
    "id" SERIAL PRIMARY KEY,
    "session_id" INTEGER NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "note" TEXT,
    "tags" VARCHAR(500),
    "springs" JSONB,
    "aero" JSONB,
    "brake_bias" REAL,
    "tire_pressures" JSONB,
    "tire_temps" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "session_notes"
    ADD CONSTRAINT "session_notes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "session_notes"
    ADD CONSTRAINT "session_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX "session_notes_session_idx" ON "session_notes"("session_id");
CREATE INDEX "session_notes_user_idx" ON "session_notes"("user_id");
