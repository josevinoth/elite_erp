from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("erp_app", "0002_comment_commentattachment_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE public.erp_app_task
                    ADD COLUMN IF NOT EXISTS activity_id bigint;

                ALTER TABLE public.erp_app_task
                    ADD COLUMN IF NOT EXISTS task_status_id bigint;

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'erp_app_task'
                          AND column_name = 'activity'
                    ) THEN
                        UPDATE public.erp_app_task t
                        SET activity_id = a.id
                        FROM public.erp_app_activity a
                        WHERE t.activity_id IS NULL
                          AND t.activity IS NOT NULL
                          AND btrim(t.activity) <> ''
                          AND lower(btrim(t.activity)) = lower(btrim(a.name));
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'erp_app_task'
                          AND column_name = 'task_status'
                    ) THEN
                        UPDATE public.erp_app_task t
                        SET task_status_id = s.id
                        FROM public.erp_app_taskstatusoption s
                        WHERE t.task_status_id IS NULL
                          AND t.task_status IS NOT NULL
                          AND btrim(t.task_status) <> ''
                          AND lower(btrim(t.task_status)) = lower(btrim(s.name));
                    END IF;
                END $$;

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'erp_app_task_activity_id_fk'
                    ) THEN
                        ALTER TABLE public.erp_app_task
                            ADD CONSTRAINT erp_app_task_activity_id_fk
                            FOREIGN KEY (activity_id)
                            REFERENCES public.erp_app_activity(id)
                            ON DELETE SET NULL;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'erp_app_task_task_status_id_fk'
                    ) THEN
                        ALTER TABLE public.erp_app_task
                            ADD CONSTRAINT erp_app_task_task_status_id_fk
                            FOREIGN KEY (task_status_id)
                            REFERENCES public.erp_app_taskstatusoption(id)
                            ON DELETE SET NULL;
                    END IF;
                END $$;

                ALTER TABLE public.erp_app_task DROP COLUMN IF EXISTS activity;
                ALTER TABLE public.erp_app_task DROP COLUMN IF EXISTS task_status;
            """,
            reverse_sql="""
                ALTER TABLE public.erp_app_task
                    ADD COLUMN IF NOT EXISTS activity varchar(255) DEFAULT '';

                ALTER TABLE public.erp_app_task
                    ADD COLUMN IF NOT EXISTS task_status varchar(100) DEFAULT '';

                UPDATE public.erp_app_task t
                SET activity = a.name
                FROM public.erp_app_activity a
                WHERE t.activity_id = a.id
                  AND (t.activity IS NULL OR btrim(t.activity) = '');

                UPDATE public.erp_app_task t
                SET task_status = s.name
                FROM public.erp_app_taskstatusoption s
                WHERE t.task_status_id = s.id
                  AND (t.task_status IS NULL OR btrim(t.task_status) = '');

                ALTER TABLE public.erp_app_task
                    DROP CONSTRAINT IF EXISTS erp_app_task_activity_id_fk;

                ALTER TABLE public.erp_app_task
                    DROP CONSTRAINT IF EXISTS erp_app_task_task_status_id_fk;
            """,
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveField(
                    model_name="task",
                    name="activity",
                ),
                migrations.RemoveField(
                    model_name="task",
                    name="task_status",
                ),
                migrations.AddField(
                    model_name="task",
                    name="activity",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tasks",
                        to="erp_app.activity",
                    ),
                ),
                migrations.AddField(
                    model_name="task",
                    name="task_status",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tasks",
                        to="erp_app.taskstatusoption",
                    ),
                ),
            ],
        ),
    ]

