-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SALES', 'INVENTORY', 'PRODUCTION', 'QUALITY', 'FINANCE', 'ADMINISTRATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "event_key" VARCHAR(180) NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" VARCHAR(80),
    "action_url" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_key" VARCHAR(180) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_alert_states" (
    "id" TEXT NOT NULL,
    "alert_key" VARCHAR(180) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "epoch" INTEGER NOT NULL DEFAULT 1,
    "last_triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "notification_alert_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_category_created_at_idx" ON "notifications"("category", "created_at");

-- CreateIndex
CREATE INDEX "notifications_event_key_idx" ON "notifications"("event_key");

-- CreateIndex
CREATE INDEX "notifications_expires_at_idx" ON "notifications"("expires_at");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_is_read_is_archived_created_at_idx" ON "user_notifications"("user_id", "is_read", "is_archived", "created_at");

-- CreateIndex
CREATE INDEX "user_notifications_notification_id_idx" ON "user_notifications"("notification_id");

-- CreateIndex
CREATE INDEX "user_notifications_created_at_idx" ON "user_notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_notification_id_user_id_key" ON "user_notifications"("notification_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_user_id_event_key_key" ON "user_notifications"("user_id", "event_key");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_category_key" ON "notification_preferences"("user_id", "category");

-- CreateIndex
CREATE INDEX "notification_outbox_status_created_at_idx" ON "notification_outbox"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_outbox_user_id_status_idx" ON "notification_outbox"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_alert_states_alert_key_key" ON "notification_alert_states"("alert_key");

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
