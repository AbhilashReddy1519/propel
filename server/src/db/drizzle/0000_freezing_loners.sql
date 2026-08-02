CREATE TYPE "public"."incident_confidence" AS ENUM('high', 'inferred', 'range');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('detected', 'acknowledged', 'crew_assigned', 'resolved', 'verified', 'closed');--> statement-breakpoint
CREATE TYPE "public"."topology_confidence" AS ENUM('known', 'inferred');--> statement-breakpoint
CREATE TYPE "public"."pole_live_state" AS ENUM('live', 'dark', 'unknown');--> statement-breakpoint
CREATE TABLE "feeders" (
	"id" text PRIMARY KEY NOT NULL,
	"sub_station_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_events" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor" text,
	"note" text,
	"ts" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"dt_id" text NOT NULL,
	"frontier_parent_pole_id" text,
	"frontier_child_pole_id" text,
	"status" "incident_status" DEFAULT 'detected' NOT NULL,
	"confidence" "incident_confidence" NOT NULL,
	"affected_pole_count" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"pincode" text,
	"reasoning" text NOT NULL,
	"suppressed_by_schedule" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"verified_at" timestamp,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "poles" (
	"id" text PRIMARY KEY NOT NULL,
	"dtId" text NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"pincode" text,
	"device_id" text,
	"parent_pole_id" text,
	"seq_on_line" integer,
	"topology_confidence" "topology_confidence" DEFAULT 'known' NOT NULL,
	CONSTRAINT "poles_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "pole_states" (
	"pole_id" text PRIMARY KEY NOT NULL,
	"current_state" "pole_live_state" DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp,
	"last_seq" integer,
	"expected_next_heartbeat_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_outages" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"target_id" text NOT NULL,
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "sub_stations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"pole_id" text,
	"event" text NOT NULL,
	"energized" boolean,
	"device_ts" timestamp NOT NULL,
	"seq" integer NOT NULL,
	"battery_mv" integer,
	"rssi" integer,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "transformers" (
	"id" text PRIMARY KEY NOT NULL,
	"feeder_id" text NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"capacity_kva" integer,
	"households_served" integer
);
--> statement-breakpoint
ALTER TABLE "feeders" ADD CONSTRAINT "feeders_sub_station_id_sub_stations_id_fk" FOREIGN KEY ("sub_station_id") REFERENCES "public"."sub_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_dt_id_transformers_id_fk" FOREIGN KEY ("dt_id") REFERENCES "public"."transformers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poles" ADD CONSTRAINT "poles_dtId_transformers_id_fk" FOREIGN KEY ("dtId") REFERENCES "public"."transformers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poles" ADD CONSTRAINT "poles_parent_pole_id_poles_id_fk" FOREIGN KEY ("parent_pole_id") REFERENCES "public"."poles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pole_states" ADD CONSTRAINT "pole_states_pole_id_poles_id_fk" FOREIGN KEY ("pole_id") REFERENCES "public"."poles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_raw" ADD CONSTRAINT "telemetry_raw_pole_id_poles_id_fk" FOREIGN KEY ("pole_id") REFERENCES "public"."poles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transformers" ADD CONSTRAINT "transformers_feeder_id_feeders_id_fk" FOREIGN KEY ("feeder_id") REFERENCES "public"."feeders"("id") ON DELETE no action ON UPDATE no action;